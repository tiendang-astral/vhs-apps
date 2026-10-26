using Microsoft.EntityFrameworkCore;
using VNEB.DTO.TaskDTO;
using VNEB.Models;
using VNEB.Repository.Notifications;
using VNEB.Responses;

namespace VNEB.Repository.Tasks
{
    public class TaskRepository : ITaskRepository
    {
        // Các trạng thái của bản đăng ký nhiệm vụ
        public const string StatusDraft = "DRAFT";
        public const string StatusApproved = "APPROVED";
        public const string StatusRejected = "REJECTED";

        // Các vai trò có quyền duyệt nhiệm vụ của cấp dưới
        public static readonly HashSet<string> ApproverRoles =
            new(StringComparer.OrdinalIgnoreCase) { "ADMIN", "CHAIRMAN", "BOD", "MANAGER", "TP" };

        private readonly VnebContext _context;
        private readonly INotificationRepository _notificationRepository;
        private readonly ILogger<TaskRepository> _logger;

        public TaskRepository(VnebContext context, INotificationRepository notificationRepository, ILogger<TaskRepository> logger)
        {
            _context = context;
            _notificationRepository = notificationRepository;
            _logger = logger;
        }

        // =====================================================================
        // DANH SÁCH CẤP DƯỚI CẦN DUYỆT
        // =====================================================================
        public async Task<Response> GetSubordinatesTasksAsync(string bossId, string month)
        {
            try
            {
                var boss = await _context.Users
                    .AsNoTracking()
                    .Where(u => u.Id == bossId)
                    .Select(u => new { u.Id, u.Role, u.DepartmentId })
                    .FirstOrDefaultAsync();

                if (boss == null) return new Response { Code = 404, Message = "Không tìm thấy người dùng" };

                var role = (boss.Role ?? string.Empty).ToUpper();
                IQueryable<User> subordinatesQuery = _context.Users.AsNoTracking().Where(u => u.Id != bossId);

                if (role == "ADMIN" || role == "CHAIRMAN")
                {
                    // Xem toàn bộ
                }
                else if (role == "BOD")
                {
                    subordinatesQuery = subordinatesQuery.Where(u =>
                        u.Role.ToUpper() == "MANAGER" || u.Role.ToUpper() == "STAFF");
                }
                else if (role == "MANAGER")
                {
                    var departmentIds = await GetChildDepartmentIds(boss.DepartmentId);
                    subordinatesQuery = subordinatesQuery.Where(u =>
                        departmentIds.Contains(u.DepartmentId) &&
                        u.Role.ToUpper() == "STAFF");
                }
                else
                {
                    return new Response { Code = 200, Data = new List<TaskApprovalDto>() };
                }

                // Chỉ lấy đúng các cột cần hiển thị (không kéo cả bảng User: mật khẩu, lương...)
                var subordinates = await subordinatesQuery
                    .Select(u => new
                    {
                        u.Id,
                        u.FullName,
                        u.Role,
                        u.DepartmentId,
                        DepartmentName = u.Department != null ? u.Department.Name : null,
                        u.Company
                    })
                    .ToListAsync();

                var subordinateIds = subordinates.Select(s => s.Id).ToList();

                // Tra cứu trạng thái bằng Dictionary thay vì FirstOrDefault lồng trong vòng lặp (O(n*m) -> O(n))
                var statusByUser = (await _context.TaskRegistrations
                        .AsNoTracking()
                        .Where(t => t.Month == month && subordinateIds.Contains(t.UserId))
                        .Select(t => new { t.UserId, t.Status })
                        .ToListAsync())
                    .GroupBy(t => t.UserId)
                    .ToDictionary(g => g.Key, g => g.First().Status);

                var result = subordinates.Select(s => new TaskApprovalDto
                {
                    UserId = s.Id,
                    FullName = s.FullName,
                    Role = s.Role,
                    DepartmentId = s.DepartmentId,
                    DepartmentName = s.DepartmentName ?? "N/A",
                    CompanyName = string.IsNullOrEmpty(s.Company) ? "VHS Group" : s.Company,
                    Month = month,
                    Status = statusByUser.TryGetValue(s.Id, out var st) ? st : "NOT_STARTED"
                }).ToList();

                return new Response { Code = 200, Data = result };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetSubordinatesTasksAsync lỗi (bossId={BossId}, month={Month})", bossId, month);
                return new Response { Code = 500, Message = ex.Message };
            }
        }

        private async Task<List<int>> GetChildDepartmentIds(int parentId)
        {
            var allDepts = await _context.Departments
                .AsNoTracking()
                .Select(d => new { d.Id, d.ParentId })
                .ToListAsync();

            var childrenLookup = allDepts.ToLookup(d => d.ParentId, d => d.Id);
            var result = new List<int> { parentId };
            var visited = new HashSet<int> { parentId };
            var queue = new Queue<int>();
            queue.Enqueue(parentId);

            // Duyệt BFS, có chống vòng lặp nếu dữ liệu phòng ban bị trỏ vòng
            while (queue.Count > 0)
            {
                var current = queue.Dequeue();
                foreach (var childId in childrenLookup[current])
                {
                    if (visited.Add(childId))
                    {
                        result.Add(childId);
                        queue.Enqueue(childId);
                    }
                }
            }
            return result;
        }

        // =====================================================================
        // LẤY BẢN ĐĂNG KÝ NHIỆM VỤ CỦA 1 NHÂN VIÊN
        // =====================================================================
        public async Task<Response> GetTasksAsync(string userId, string month)
        {
            // Trả về đúng các trường giao diện cần (trước đây trả nguyên entity User kèm PasswordHash, lương, tài khoản ngân hàng...)
            var registration = await _context.TaskRegistrations
                .AsNoTracking()
                .Where(r => r.UserId == userId && r.Month == month)
                .Select(r => new
                {
                    r.Id,
                    r.UserId,
                    r.Month,
                    r.Status,
                    User = r.User == null ? null : new
                    {
                        r.User.Id,
                        r.User.FullName,
                        r.User.Role,
                        r.User.DepartmentId,
                        r.User.Company
                    },
                    TaskSections = r.TaskSections.Select(s => new
                    {
                        s.Id,
                        s.RegistrationId,
                        s.Category,
                        s.SectionName,
                        TaskItems = s.TaskItems.Select(t => new
                        {
                            t.Id,
                            t.SectionId,
                            t.TaskDescription,
                            t.StartDate,
                            t.EndDate,
                            t.ExpectedOutcome,
                            t.PersonalTarget,
                            t.ManagerTarget,
                            t.PersonalResult,
                            t.ManagerResult,
                            t.PersonalPriority,
                            t.ManagerPriority,
                            t.PersonalComplexity,
                            t.ManagerComplexity,
                            t.Note
                        }).ToList()
                    }).ToList()
                })
                .AsSplitQuery()
                .FirstOrDefaultAsync();

            if (registration == null)
            {
                var user = await _context.Users
                    .AsNoTracking()
                    .Where(u => u.Id == userId)
                    .Select(u => new { u.Id, u.FullName, u.Role, u.DepartmentId, u.Company })
                    .FirstOrDefaultAsync();

                return new Response
                {
                    Code = 200,
                    Data = new
                    {
                        userId,
                        month,
                        fullName = user?.FullName,
                        user,
                        status = StatusDraft,
                        taskSections = new List<object>()
                    }
                };
            }

            return new Response { Code = 200, Data = registration };
        }

        // =====================================================================
        // LƯU / GỬI DUYỆT
        // =====================================================================
        public async Task<Response> SaveTasksAsync(SaveTaskRegistrationDTO dto, string? currentUserId, string? currentUserRole)
        {
            if (string.IsNullOrWhiteSpace(dto.UserId) || string.IsNullOrWhiteSpace(dto.Month))
                return new Response { Code = 400, Message = "Thiếu thông tin nhân viên hoặc tháng" };

            var isOwner = currentUserId == null || currentUserId == dto.UserId;
            var isApprover = currentUserRole != null && ApproverRoles.Contains(currentUserRole);

            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var existingReg = await _context.TaskRegistrations
                    .Include(r => r.TaskSections)
                        .ThenInclude(s => s.TaskItems)
                    .AsSplitQuery()
                    .FirstOrDefaultAsync(r => r.UserId == dto.UserId && r.Month == dto.Month);

                var requestedStatus = string.IsNullOrWhiteSpace(dto.Status) ? StatusDraft : dto.Status.ToUpper();

                // Nhân viên tự lưu thì không được tự chuyển sang APPROVED / REJECTED
                if (!isApprover && isOwner &&
                    (requestedStatus == StatusApproved || requestedStatus == StatusRejected) &&
                    existingReg?.Status != requestedStatus)
                {
                    requestedStatus = existingReg?.Status ?? StatusDraft;
                }

                if (existingReg == null)
                {
                    existingReg = new TaskRegistration { UserId = dto.UserId, Month = dto.Month, Status = requestedStatus };
                    _context.TaskRegistrations.Add(existingReg);
                }
                else
                {
                    existingReg.Status = requestedStatus;
                    // Xóa toàn bộ hạng mục cũ (TaskItems bị xóa theo cascade vì đã được load)
                    _context.TaskItems.RemoveRange(existingReg.TaskSections.SelectMany(s => s.TaskItems));
                    _context.TaskSections.RemoveRange(existingReg.TaskSections);
                }

                foreach (var secDto in dto.TaskSections ?? new List<TaskSectionDTO>())
                {
                    var newSection = new TaskSection
                    {
                        RegistrationId = existingReg.Id,
                        Category = secDto.Category,
                        SectionName = secDto.SectionName,
                        TaskItems = (secDto.TaskItems ?? new List<TaskItemDTO>()).Select(t => new TaskItem
                        {
                            TaskDescription = t.TaskDescription ?? string.Empty,
                            StartDate = t.StartDate ?? string.Empty,
                            EndDate = t.EndDate ?? string.Empty,
                            ExpectedOutcome = t.ExpectedOutcome ?? string.Empty,
                            PersonalTarget = t.PersonalTarget ?? string.Empty,
                            ManagerTarget = t.ManagerTarget ?? string.Empty,
                            PersonalResult = t.PersonalResult ?? string.Empty,
                            ManagerResult = t.ManagerResult ?? string.Empty,
                            PersonalPriority = t.PersonalPriority ?? string.Empty,
                            ManagerPriority = t.ManagerPriority ?? string.Empty,
                            PersonalComplexity = t.PersonalComplexity ?? string.Empty,
                            ManagerComplexity = t.ManagerComplexity ?? string.Empty,
                            Note = t.Note ?? string.Empty,
                        }).ToList()
                    };
                    _context.TaskSections.Add(newSection);
                }

                // Gộp thành 1 lần SaveChanges (trước đây 2 lần)
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                // Chỉ báo cho nhân viên khi người khác (cấp trên) sửa hồ sơ của họ
                if (!isOwner)
                {
                    await SafeNotify(dto.UserId, "Sếp vừa cập nhật công việc cho bạn!", "TASK_UPDATE", "/tasks/my-task");
                }

                return new Response { Code = 200, Message = "Lưu thành công", Data = existingReg.Id };
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "SaveTasksAsync lỗi (userId={UserId}, month={Month})", dto.UserId, dto.Month);
                return new Response { Code = 500, Message = "Lỗi: " + (ex.InnerException?.Message ?? ex.Message) };
            }
        }

        // Giữ chữ ký cũ cho interface
        public Task<Response> SaveTasksAsync(SaveTaskRegistrationDTO dto) => SaveTasksAsync(dto, null, null);

        // =====================================================================
        // DUYỆT / TRẢ LẠI
        // =====================================================================
        public async Task<Response> ApproveOrRejectTaskAsync(string registrationId, string action, string bossRole)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(registrationId))
                    return new Response { Code = 400, Message = "Thiếu mã bản đăng ký. Vui lòng lưu hồ sơ trước khi duyệt." };

                var normalizedAction = (action ?? string.Empty).ToUpper();
                if (normalizedAction != "APPROVE" && normalizedAction != "REJECT")
                    return new Response { Code = 400, Message = "Thao tác không hợp lệ" };

                var task = await _context.TaskRegistrations.FindAsync(registrationId);
                if (task == null) return new Response { Code = 404, Message = "Không tìm thấy bản đăng ký" };

                task.Status = normalizedAction == "REJECT" ? StatusRejected : StatusApproved;
                await _context.SaveChangesAsync();

                var isApprove = normalizedAction == "APPROVE";
                await SafeNotify(
                    task.UserId,
                    isApprove
                        ? $"Nhiệm vụ tháng {task.Month} của bạn đã được phê duyệt."
                        : $"Nhiệm vụ tháng {task.Month} của bạn bị trả lại, vui lòng chỉnh sửa.",
                    isApprove ? "TASK_APPROVED" : "TASK_REJECTED",
                    "/tasks/my-task");

                return new Response { Code = 200, Message = $"Đã {(isApprove ? "duyệt" : "trả lại")} thành công", Data = task.Status };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ApproveOrRejectTaskAsync lỗi (registrationId={Id})", registrationId);
                return new Response { Code = 500, Message = "Lỗi xử lý: " + ex.Message };
            }
        }

        // Lỗi gửi thông báo (SignalR/DB) không được làm hỏng thao tác chính đã lưu thành công
        private async Task SafeNotify(string userId, string message, string type, string link)
        {
            try
            {
                await _notificationRepository.SendAndSave(userId, message, type, link);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Gửi thông báo thất bại cho user {UserId}", userId);
            }
        }

        // =====================================================================
        // THỐNG KÊ HIỆU SUẤT (DASHBOARD)
        // =====================================================================
        private sealed class StatItem
        {
            public string UserId { get; init; } = string.Empty;
            public int ManagerScore { get; init; }
            public Level Complexity { get; init; }
            public Level Priority { get; init; }
        }

        private enum Level { None, High, Medium, Low }

        // Chấp nhận cả giá trị tiếng Anh/tiếng Việt và các giá trị mà giao diện đang dùng
        // (Độ phức tạp trên form là Complex / Normal / Simple – trước đây Complex & Simple không được đếm)
        private static Level ParseLevel(string? val) => (val ?? string.Empty).Trim() switch
        {
            "High" or "Cao" or "Complex" or "P.Tạp" or "Phức tạp" => Level.High,
            "Medium" or "Normal" or "T.Bình" or "Trung bình" or "B.Thường" or "Bình thường" => Level.Medium,
            "Low" or "Thấp" or "Simple" or "D.Giản" or "Đơn giản" => Level.Low,
            _ => Level.None
        };

        private static int ParseScore(string? val) =>
            int.TryParse(val?.Replace("%", "").Trim(), out var res) ? res : 0;

        public async Task<Response> GetPerformanceStatsAsync(string? userId, int? deptId, DateTime fromDate, DateTime toDate)
        {
            try
            {
                var query = _context.TaskItems.AsNoTracking()
                    .Where(ti => ti.TaskSection != null && ti.TaskSection.TaskRegistration != null);

                var targetUsers = new List<(string Id, string FullName)>();
                if (!string.IsNullOrWhiteSpace(userId))
                {
                    query = query.Where(ti => ti.TaskSection!.TaskRegistration!.UserId == userId);
                }
                else if (deptId.HasValue)
                {
                    var childDepts = await GetChildDepartmentIds(deptId.Value);
                    targetUsers = (await _context.Users
                            .AsNoTracking()
                            .Where(u => childDepts.Contains(u.DepartmentId))
                            .Select(u => new { u.Id, u.FullName })
                            .ToListAsync())
                        .Select(u => (u.Id, u.FullName))
                        .ToList();

                    query = query.Where(ti => childDepts.Contains(ti.TaskSection!.TaskRegistration!.User!.DepartmentId));
                }

                // Chỉ lấy các cột cần thiết thay vì Include toàn bộ Section + Registration
                var rawItems = await query
                    .Where(ti => ti.TaskDescription != null && ti.TaskDescription.Trim() != "")
                    .Select(ti => new
                    {
                        UserId = ti.TaskSection!.TaskRegistration!.UserId,
                        ti.StartDate,
                        ti.EndDate,
                        ti.ManagerResult,
                        ti.ManagerComplexity,
                        ti.ManagerPriority
                    })
                    .ToListAsync();

                var from = fromDate.Date;
                var to = toDate.Date;

                var items = new List<StatItem>(rawItems.Count);
                foreach (var t in rawItems)
                {
                    if (!DateTime.TryParse(t.StartDate, out var taskStart)) continue;
                    if (!DateTime.TryParse(t.EndDate, out var taskEnd)) continue;
                    if (taskStart.Date < from || taskStart.Date > to || taskEnd.Date > to) continue;

                    items.Add(new StatItem
                    {
                        UserId = t.UserId,
                        ManagerScore = ParseScore(t.ManagerResult),
                        Complexity = ParseLevel(t.ManagerComplexity),
                        Priority = ParseLevel(t.ManagerPriority)
                    });
                }

                // Danh sách nhân viên: gom nhóm 1 lần thay vì lọc lại toàn bộ list cho từng người
                var employeeList = new List<object>();
                if (string.IsNullOrWhiteSpace(userId) && targetUsers.Count > 0)
                {
                    var byUser = items.GroupBy(i => i.UserId).ToDictionary(
                        g => g.Key,
                        g => (Total: g.Count(), Completed: g.Count(x => x.ManagerScore == 100)));

                    employeeList = targetUsers.Select(u =>
                    {
                        var s = byUser.TryGetValue(u.Id, out var v) ? v : (Total: 0, Completed: 0);
                        return (object)new { Id = u.Id, FullName = u.FullName, Total = s.Total, Completed = s.Completed };
                    }).ToList();
                }

                var total = items.Count;
                int completedOnTime = 0, completedEffort = 0, completedWarning = 0, notMet = 0;
                int highCount = 0, mediumCount = 0, lowCount = 0;
                long highSum = 0, mediumSum = 0, lowSum = 0;
                int highPriority = 0, mediumPriority = 0, lowPriority = 0;

                // Một vòng lặp duy nhất thay vì ~12 lần duyệt danh sách
                foreach (var i in items)
                {
                    var score = i.ManagerScore;
                    if (score == 100) completedOnTime++;
                    else if (score >= 70 && score < 100) completedEffort++;
                    else if (score >= 30 && score < 70) completedWarning++;
                    if (score < 30) notMet++;

                    switch (i.Complexity)
                    {
                        case Level.High: highCount++; highSum += score; break;
                        case Level.Medium: mediumCount++; mediumSum += score; break;
                        case Level.Low: lowCount++; lowSum += score; break;
                    }

                    switch (i.Priority)
                    {
                        case Level.High: highPriority++; break;
                        case Level.Medium: mediumPriority++; break;
                        case Level.Low: lowPriority++; break;
                    }
                }

                static double Avg(long sum, int count) => count == 0 ? 0 : Math.Round((double)sum / count, 1);
                static double Pct(int count, int all) => all == 0 ? 0 : Math.Round((double)count / all * 100, 1);

                var result = new
                {
                    SectionKPI = new
                    {
                        TotalRegistered = total,
                        CompletedOnTime = completedOnTime,
                        CompletedEffort = completedEffort,
                        CompletedWarning = completedWarning,
                        NotMet = notMet
                    },
                    SectionComplexity = new
                    {
                        Counts = new { High = highCount, Medium = mediumCount, Low = lowCount },
                        CompletionRates = new
                        {
                            HighRate = Avg(highSum, highCount),
                            MediumRate = Avg(mediumSum, mediumCount),
                            LowRate = Avg(lowSum, lowCount)
                        }
                    },
                    SectionPriority = new
                    {
                        HighPriorityRate = Pct(highPriority, total),
                        MediumPriorityRate = Pct(mediumPriority, total),
                        LowPriorityRate = Pct(lowPriority, total)
                    },
                    // Luôn trả danh sách nhân viên (kể cả khi chưa có nhiệm vụ) để dashboard hiển thị đúng
                    EmployeeList = employeeList
                };

                return new Response { Code = 200, Data = result };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetPerformanceStatsAsync lỗi");
                return new Response { Code = 500, Message = ex.Message };
            }
        }
    }
}
