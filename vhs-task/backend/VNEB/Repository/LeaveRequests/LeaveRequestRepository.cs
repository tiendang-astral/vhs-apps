using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using VNEB.Models;
using VNEB.Repository.Notifications;
using VNEB.Responses;

namespace VNEB.Repository.LeaveRequests
{
    public class LeaveRequestRepository : ILeaveRequestRepository
    {
        private readonly VnebContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly INotificationRepository _notificationRepo;
        public LeaveRequestRepository(VnebContext context, IHttpContextAccessor httpContextAccessor, INotificationRepository notificationRepo)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
            _notificationRepo = notificationRepo;
        }

        private string GetCurrentUserId() =>
            _httpContextAccessor.HttpContext?.User?.FindFirstValue(ClaimTypes.NameIdentifier);

        public async Task<Response> Create(LeaveRequest request)
        {
            try
            {
                var userId = GetCurrentUserId();
                var user = await _context.Users.FindAsync(userId);
                if (user == null) return new Response { Code = 404, Message = "User not found" };

                request.UserId = userId;

                // Fix lỗi EndDate năm 0001 nếu người dùng không chọn ngày kết thúc (mặc định nghỉ 1 ngày)
                if (request.EndDate < request.RequestDate || request.EndDate.Year < 2000)
                {
                    request.EndDate = request.RequestDate;
                }

                string role = user.Role?.ToUpper() ?? "STAFF";
                request.Status = 0;

                if (role == "STAFF")
                    request.CurrentApproverRole = "MANAGER";
                else if (role == "MANAGER" || role == "TP")
                    request.CurrentApproverRole = "BOD";
                else if (role == "BOD")
                    request.CurrentApproverRole = "CHAIRMAN";
                else if (role == "CHAIRMAN" || role == "ADMIN")
                {
                    request.Status = 1;
                    request.ApprovedDate = DateTime.Now;
                    request.ApprovedBy = "Hệ thống";
                    request.CurrentApproverRole = "Done";
                }
                else
                {
                    request.CurrentApproverRole = "MANAGER";
                }

                _context.LeaveRequests.Add(request);
                await _context.SaveChangesAsync();

                return new Response { Code = 200, Data = request, Message = "Tạo đơn thành công" };
            }
            catch (Exception ex)
            {
                return new Response { Code = 500, Message = ex.Message };
            }
        }

        public async Task<Response> Approve(int requestId, string approverRole)
        {
            try
            {
                // 1. Lấy thông tin đơn nghỉ phép
                var req = await _context.LeaveRequests
                    .Include(r => r.User)
                    .FirstOrDefaultAsync(x => x.Id == requestId);

                if (req == null) return new Response { Code = 404, Message = "Đơn không tồn tại" };

                var approverId = GetCurrentUserId();
                var approver = await _context.Users.FindAsync(approverId);
                if (approver == null) return new Response { Code = 401, Message = "Unauthorized" };

                bool isChairman = approverRole.ToUpper() == "CHAIRMAN";

                if (!isChairman)
                {

                    if (req.CurrentApproverRole?.ToUpper() != approverRole?.ToUpper())
                    {
                        return new Response { Code = 403, Message = "Đơn này hiện không chờ cấp của bạn duyệt" };
                    }

                    if (approverRole.ToUpper() == "MANAGER" && req.User.DepartmentId != approver.DepartmentId)
                    {
                        return new Response { Code = 403, Message = "Trưởng phòng chỉ được duyệt đơn của phòng mình" };
                    }
                }

                req.Status = 1;
                req.CurrentApproverRole = "Done";
                req.ApprovedBy = approver.FullName;
                req.ApprovedDate = DateTime.Now;
                double leaveDays = (req.EndDate.Year < 2000 || req.EndDate < req.RequestDate)
                          ? 1.0
                          : (req.EndDate.Date - req.RequestDate.Date).Days + 1.0;

                var quota = await _context.UserLeaveQuotas.FirstOrDefaultAsync(q => q.UserId == req.UserId);
                if (quota == null)
                {
                    quota = new UserLeaveQuota
                    {
                        UserId = req.UserId,
                        RemainingLastYear = 0,
                        NewQuota = 0,
                        UsedPaidLeave = 0,
                        UnpaidLeave = 0,
                        SpecialLeave = 0,
                        LateEarlyCount = 0
                    };
                    _context.UserLeaveQuotas.Add(quota);
                }

                string type = req.ConfirmationType ?? "";
                if (type.Equals("Nghỉ phép", StringComparison.OrdinalIgnoreCase))
                {
                    quota.UsedPaidLeave = (quota.UsedPaidLeave) + leaveDays;
                }
                else if (type.Contains("Không lương") || type.Contains("Việc riêng"))
                {
                    quota.UnpaidLeave = (quota.UnpaidLeave) + leaveDays;
                }
                else if (type.Equals("Nghỉ chế độ", StringComparison.OrdinalIgnoreCase))
                {
                    quota.SpecialLeave = (quota.SpecialLeave) + leaveDays;
                }
                else if (type.Contains("Đi muộn") || type.Contains("Về sớm"))
                {
                    quota.LateEarlyCount = (quota.LateEarlyCount) + 1;
                }

                await _context.SaveChangesAsync();

                return new Response { Code = 200, Message = "Phê duyệt và cập nhật định mức thành công!", Data = req };
            }
            catch (Exception ex) { return new Response { Code = 500, Message = ex.Message }; }
        }

        public async Task<Response> GetUserLeaveQuotaReport(string? companyFilter, int? deptId)
        {
            try
            {
                // Vẫn lấy bảng Users làm gốc để hiển thị đầy đủ nhân viên
                var query = _context.Users
                    .Include(u => u.Department)
                    .AsQueryable();

                if (!string.IsNullOrEmpty(companyFilter))
                    query = query.Where(u => u.Company == companyFilter);
                if (deptId.HasValue && deptId > 0)
                    query = query.Where(u => u.DepartmentId == deptId);

                var allUsers = await query.ToListAsync();
                var allQuotas = await _context.UserLeaveQuotas.ToListAsync();

                var data = allUsers.Select(u => {
                    var q = allQuotas.FirstOrDefault(x => x.UserId == u.Id);

                    double totalQuota = (q?.RemainingLastYear ?? 0) + (q?.NewQuota ?? 0);
                    double usedPaid = q?.UsedPaidLeave ?? 0;

                    return new
                    {
                        UserId = u.Id,
                        FullName = u.FullName,
                        DepartmentName = u.Department?.Name ?? "N/A",
                        RemainingLastYear = q?.RemainingLastYear ?? 0,
                        NewQuota = q?.NewQuota ?? 0,
                        TotalQuota = totalQuota,
                        UsedPaidLeave = usedPaid,
                        UnpaidLeave = q?.UnpaidLeave ?? 0,
                        SpecialLeave = q?.SpecialLeave ?? 0,
                        LateEarlyCount = q?.LateEarlyCount ?? 0,
                        // Phép còn lại = Tổng định mức - Đã nghỉ phép
                        RemainingDays = totalQuota - usedPaid
                    };
                }).ToList();

                return new Response { Code = 200, Data = data, Message = "Thành công" };
            }
            catch (Exception ex) { return new Response { Code = 500, Message = ex.Message }; }
        }

        public async Task<Response> UpdateLeaveQuota(UserLeaveQuota quota)
        {
            try
            {
                var existing = await _context.UserLeaveQuotas.FirstOrDefaultAsync(x => x.UserId == quota.UserId);
                if (existing == null)
                {
                    _context.UserLeaveQuotas.Add(new UserLeaveQuota
                    {
                        UserId = quota.UserId,
                        RemainingLastYear = quota.RemainingLastYear,
                        NewQuota = quota.NewQuota
                    });
                }
                else
                {
                    existing.RemainingLastYear = quota.RemainingLastYear;
                    existing.NewQuota = quota.NewQuota;
                }
                await _context.SaveChangesAsync();
                return new Response { Code = 200, Message = "Cập nhật thành công" };
            }
            catch (Exception ex) { return new Response { Code = 500, Message = ex.Message }; }
        }

        public async Task<Response> GetForApprover()
        {
            var currentUserId = GetCurrentUserId();
            // Lấy user hiện tại kèm thông tin phòng ban
            var currentUser = await _context.Users
                .Include(u => u.Department)
                .FirstOrDefaultAsync(u => u.Id == currentUserId);

            if (currentUser == null) return new Response { Code = 401 };

            var query = _context.LeaveRequests
                .Include(r => r.User)
                .ThenInclude(u => u.Department)
                .AsQueryable();

            string role = currentUser.Role?.ToUpper();
            string deptName = currentUser.Department?.Name?.ToUpper();

            if (role == "CHAIRMAN" || deptName == "HCNS")
            {
                query = query.Where(r => r.Status == 0);
            }
            else if (role == "BOD")
            {
                query = query.Where(r => r.User.Company == currentUser.Company && r.CurrentApproverRole == "BOD");
            }
            else if (role == "MANAGER" || role == "TP")
            {
                query = query.Where(r => r.User.DepartmentId == currentUser.DepartmentId && r.CurrentApproverRole == "MANAGER");
            }
            else
            {
                return new Response { Code = 200, Data = new List<object>() };
            }

            var data = await query.OrderByDescending(r => r.RequestDate)
                .Select(r => new {
                    r.Id,
                    r.UserId,
                    FullName = r.User.FullName,
                    DepartmentId = r.User.DepartmentId,
                    DepartmentName = r.User.Department != null ? r.User.Department.Name : "N/A",
                    r.ConfirmationType,
                    r.RequestDate,
                    r.EndDate,
                    r.FromTime,
                    r.ToTime,
                    r.Reason,
                    r.Status,
                    r.CurrentApproverRole
                }).ToListAsync();

            return new Response { Code = 200, Data = data };
        }

        public async Task<Response> GetStatisticalForHR(string? companyFilter, int? deptId)
        {
            try
            {
                // 1. Khởi tạo query với đầy đủ thông tin User và Phòng ban
                var query = _context.LeaveRequests
                    .Include(r => r.User)
                    .ThenInclude(u => u.Department)
                    .AsQueryable();

                // 2. LOGIC LỌC THÔNG MINH CHO HCNS
                // Nếu truyền Filter cụ thể (ví dụ chọn từ Dropdown trên Web) thì mới lọc.
                // Còn nếu HCNS vào màn hình chung, ta nên để họ thấy HẾT.
                if (!string.IsNullOrEmpty(companyFilter))
                {
                    query = query.Where(r => r.User.Company == companyFilter);
                }

                if (deptId.HasValue && deptId.Value > 0)
                {
                    query = query.Where(r => r.User.DepartmentId == deptId);
                }

                var data = await query
                    .OrderBy(r => r.Status)
                    .ThenByDescending(r => r.RequestDate)
                    .Select(r => new {
                        r.Id,
                        r.UserId,
                        FullName = r.User.FullName,
                        Company = r.User.Company,
                        DepartmentId = r.User.DepartmentId,
                        DepartmentName = r.User.Department != null ? r.User.Department.Name : "N/A",
                        r.ConfirmationType,
                        r.RequestDate,
                        EndDate = r.EndDate,
                        r.FromTime,
                        r.ToTime,
                        r.Reason,
                        r.Status,
                        r.CurrentApproverRole,
                        r.ApprovedBy,
                        r.ApprovedDate
                    }).ToListAsync();

                return new Response { Code = 200, Data = data, Message = "Thành công" };
            }
            catch (Exception ex)
            {
                return new Response { Code = 500, Message = ex.Message };
            }
        }

        public async Task<Response> GetByUser()
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                if (string.IsNullOrEmpty(currentUserId)) return new Response { Code = 401 };

                var data = await _context.LeaveRequests
                    .Where(r => r.UserId == currentUserId)
                    .OrderByDescending(r => r.RequestDate)
                    .Select(r => new {
                        r.Id,
                        r.ConfirmationType,
                        r.RequestDate,
                        r.FromTime,
                        r.ToTime,
                        r.Reason,
                        r.Status,
                        r.CurrentApproverRole,
                        r.ApprovedBy,
                        r.ApprovedDate
                    }).ToListAsync();

                return new Response { Code = 200, Data = data, Message = "Success" };
            }
            catch (Exception ex) { return new Response { Code = 500, Message = ex.Message }; }
        }

        public async Task<Response> Delete(int id)
        {
            try
            {
                var item = await _context.LeaveRequests.FindAsync(id);
                if (item == null) return new Response { Code = 404, Message = "Không tìm thấy đơn" };

                // Nếu đơn đã Approve (Status = 1) mới cần trừ lại Quota
                if (item.Status == 1)
                {
                    var quota = await _context.UserLeaveQuotas.FirstOrDefaultAsync(q => q.UserId == item.UserId);
                    if (quota != null)
                    {
                        double leaveDays = (item.EndDate.Year < 2000 || item.EndDate < item.RequestDate)
                                          ? 1.0
                                          : (double)(item.EndDate.Date - item.RequestDate.Date).Days + 1.0;

                        string type = item.ConfirmationType ?? "";

                        if (type.Equals("Nghỉ phép", StringComparison.OrdinalIgnoreCase))
                            quota.UsedPaidLeave = Math.Max(0, (quota.UsedPaidLeave) - leaveDays);
                        else if (type.Contains("Không lương") || type.Contains("Việc riêng"))
                            quota.UnpaidLeave = Math.Max(0, (quota.UnpaidLeave) - leaveDays);
                        else if (type.Equals("Nghỉ chế độ", StringComparison.OrdinalIgnoreCase))
                            quota.SpecialLeave = Math.Max(0, (quota.SpecialLeave) - leaveDays);
                        else if (type.Contains("Đi muộn") || type.Contains("Về sớm"))
                            quota.LateEarlyCount = Math.Max(0, (quota.LateEarlyCount) - 1);
                    }
                }

                _context.LeaveRequests.Remove(item);
                await _context.SaveChangesAsync();
                return new Response { Code = 200, Message = "Xóa đơn thành công" };
            }
            catch (Exception ex) { return new Response { Code = 500, Message = ex.Message }; }
        }
        public async Task<Response> Reject(int requestId, string reason)
        {
            try
            {
                // 1. Tìm đơn nghỉ phép kèm thông tin User để lấy ID gửi thông báo
                var req = await _context.LeaveRequests
                    .Include(r => r.User)
                    .FirstOrDefaultAsync(x => x.Id == requestId);

                if (req == null) return new Response { Code = 404, Message = "Đơn không tồn tại" };

                var approverId = GetCurrentUserId();
                var approver = await _context.Users.FindAsync(approverId);

                string applicantId = req.UserId;
                string leaveType = req.ConfirmationType ?? "nghỉ phép";
                string dateStr = req.RequestDate.ToString("dd/MM/yyyy");

                // 2. Gửi thông báo cho người lập đơn trước khi xóa đơn
                string msg = $"Đơn {leaveType} ngày {dateStr} của bạn đã bị từ chối bởi {approver?.FullName}. Lý do: {reason}";

                await _notificationRepo.SendAndSave(
                    applicantId,
                    msg,
                    "REJECT_LEAVE",
                    "/leave-management"
                );


                _context.LeaveRequests.Remove(req);

                await _context.SaveChangesAsync();

                return new Response { Code = 200, Message = "Đã từ chối và xóa đơn thành công!" };
            }
            catch (Exception ex)
            {
                return new Response { Code = 500, Message = "Lỗi khi từ chối đơn: " + ex.Message };
            }
        }
    }
}