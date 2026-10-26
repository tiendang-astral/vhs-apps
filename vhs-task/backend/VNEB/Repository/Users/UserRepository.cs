using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using VNEB.DTO.UserDTO;
using VNEB.Helpers;
using VNEB.Models;
using VNEB.Responses;

namespace VNEB.Repository.Users
{
    public class UserRepository : IUserRepository
    {
        private readonly VnebContext _context;
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _webHostEnvironment;

        public UserRepository(VnebContext context, IConfiguration configuration, IWebHostEnvironment webHostEnvironment)
        {
            _context = context;
            _configuration = configuration;
            _webHostEnvironment = webHostEnvironment;
        }

        public async Task<Response> Login(LoginDTO login)
        {
            var user = await _context.Users
                .Include(u => u.Department)
                .FirstOrDefaultAsync(u => u.Username == login.Username);

            if (user == null || !PasswordHasher.Verify(login.Password, user.PasswordHash, out var needsUpgrade))
            {
                return new Response { Code = 400, Message = "Tên đăng nhập hoặc mật khẩu không đúng." };
            }

            // Mật khẩu đang lưu kiểu cũ (SHA256 không salt) -> tự băm lại bằng PBKDF2 khi đăng nhập thành công
            if (needsUpgrade)
            {
                user.PasswordHash = PasswordHasher.Hash(login.Password);
                await _context.SaveChangesAsync();
            }
            var deptName = user.Department?.Name ?? "";
            var claims = new List<Claim>
    {
        new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new Claim(ClaimTypes.Name, user.Username),
        new Claim(ClaimTypes.Role, user.Role),
        new Claim("FullName", user.FullName),
        new Claim("Company", user.Company), // VNEB / VHS
        new Claim("DeptId", user.DepartmentId.ToString()),
        new Claim("DeptName", deptName),
    };

            var token = GenerateJwtToken(claims);

            return new Response
            {
                Code = 200,
                Message = "Login successful",
                Data = new
                {
                    Token = token,
                    Username = user.Username,
                    FullName = user.FullName,
                    Role = user.Role,
                    Company = user.Company,
                    DepartmentId = user.DepartmentId,
                    DeptName = user.Department?.Name ?? ""
                }
            };
        }

        public async Task<Response> Create(NewUserDTO newUser)
        {
            try
            {
                // 1. Kiểm tra trùng username
                if (await _context.Users.AnyAsync(u => u.Username == newUser.Username))
                    return new Response { Code = 400, Message = "Tên đăng nhập đã tồn tại." };

                var passwordError = ValidatePassword(newUser.Password);
                if (passwordError != null) return new Response { Code = 400, Message = passwordError };

                // 2. Tạo Model từ DTO
                var user = new User
                {
                    Id = Guid.NewGuid().ToString(),
                    Username = newUser.Username,
                    FullName = newUser.FullName,
                    Email = newUser.Email,
                    Role = newUser.Role,
                    Company = newUser.Company, // Bổ sung Company
                    DepartmentId = newUser.DepartmentId,
                    PasswordHash = PasswordHasher.Hash(newUser.Password) // PBKDF2 có salt
                };

                _context.Users.Add(user);
                await _context.SaveChangesAsync();

                return new Response { Code = 200, Message = "Tạo tài khoản thành công." };
            }
            catch (Exception ex)
            {
                return new Response { Code = 500, Message = $"Lỗi hệ thống: {ex.Message}" };
            }
        }

        public async Task<Response> GetUsersByDepartment(string departmentId)
        {
            var users = await _context.Users
                .Where(u => u.DepartmentId.ToString() == departmentId)
                .Select(u => new { u.Id, u.FullName }) 
                .ToListAsync();

            return new Response { Code = 200, Data = users };
        }

        public async Task<Response> GetById(string id)
        {
            var user = await _context.Users.Include(u => u.Department).FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return new Response { Code = 404, Message = "User not found" };
            return new Response { Code = 200, Data = user };
        }

        public Task<Response> GetAllUsers() => GetAllUsers(true);

        public async Task<Response> GetAllUsers(bool includeHrDetails)
        {
            if (includeHrDetails)
            {
                // Bộ phận nhân sự: đầy đủ hồ sơ (PasswordHash / RefreshToken đã bị [JsonIgnore] trong model)
                var users = await _context.Users.AsNoTracking().Include(u => u.Department).ToListAsync();
                return new Response { Code = 200, Data = users };
            }

            // Người dùng khác: chỉ thông tin cơ bản, không có lương, CCCD, tài khoản ngân hàng...
            var basic = await _context.Users
                .AsNoTracking()
                .Select(u => new
                {
                    u.Id,
                    u.Username,
                    u.FullName,
                    u.Email,
                    u.Role,
                    u.Company,
                    u.Position,
                    u.AvatarPath,
                    u.DepartmentId,
                    Department = u.Department == null ? null : new { u.Department.Id, u.Department.Name, u.Department.ParentId }
                })
                .ToListAsync();
            return new Response { Code = 200, Data = basic };
        }

        public async Task<Response> UpdateUserInfo(User model)
        {
            try
            {
                var user = await _context.Users.FindAsync(model.Id);
                if (user == null) return new Response { Code = 404, Message = "Không tìm thấy nhân viên." };

                user.FullName = model.FullName;
                user.Gender = model.Gender;
                user.Birthday = model.Birthday;
                user.IdCardNumber = model.IdCardNumber;
                user.IdCardIssuedDate = model.IdCardIssuedDate;
                user.IdCardIssuedPlace = model.IdCardIssuedPlace;
                user.PermanentAddress = model.PermanentAddress;
                user.Ethnic = model.Ethnic;
                user.PhoneNumber = model.PhoneNumber;

                user.Position = model.Position;
                user.EducationLevel = model.EducationLevel;
                user.School = model.School;
                user.Major = model.Major;
                user.DepartmentId = model.DepartmentId;
                user.JoinDate = model.JoinDate;
                user.ProbationStartDate = model.ProbationStartDate;
                user.ProbationEndDate = model.ProbationEndDate;

                user.ProbationSalary = model.ProbationSalary;
                user.OfficialSalary = model.OfficialSalary;
                user.InsuranceSalaryStart = model.InsuranceSalaryStart;
                user.InsuranceSalaryCurrent = model.InsuranceSalaryCurrent;
                user.TaxCode = model.TaxCode;
                user.InsuranceCode = model.InsuranceCode;
                user.BankAccountNumber = model.BankAccountNumber;
                user.BankName = model.BankName;

                if (!string.IsNullOrEmpty(model.OfficialContractFile1)) user.OfficialContractFile1 = model.OfficialContractFile1;
                if (!string.IsNullOrEmpty(model.OfficialContractFile2)) user.OfficialContractFile2 = model.OfficialContractFile2;
                if (!string.IsNullOrEmpty(model.OfficialContractFile3)) user.OfficialContractFile3 = model.OfficialContractFile3;
                if (!string.IsNullOrEmpty(model.AvatarPath)) user.AvatarPath = model.AvatarPath;

                await _context.SaveChangesAsync();
                return new Response { Code = 200, Message = "Cập nhật thông tin nhân sự thành công." };
            }
            catch (Exception ex)
            {
                return new Response { Code = 500, Message = $"Lỗi cập nhật: {ex.Message}" };
            }
        }

        // Chỉ chấp nhận đúng loại file, chặn upload file .html/.js/.exe... lên server
        private static readonly HashSet<string> AvatarExtensions = new(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
        private static readonly HashSet<string> ContractExtensions = new(StringComparer.OrdinalIgnoreCase) { ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png" };
        private const long MaxAvatarBytes = 5 * 1024 * 1024;     // 5 MB
        private const long MaxContractBytes = 20 * 1024 * 1024;  // 20 MB

        private static void ValidateUpload(IFormFile? file, HashSet<string> allowedExtensions, long maxBytes)
        {
            if (file == null || file.Length == 0) throw new InvalidOperationException("Chưa chọn file.");
            if (file.Length > maxBytes) throw new InvalidOperationException($"File vượt quá {maxBytes / 1024 / 1024} MB.");
            var ext = Path.GetExtension(file.FileName);
            if (string.IsNullOrEmpty(ext) || !allowedExtensions.Contains(ext))
                throw new InvalidOperationException($"Định dạng file không được phép. Chỉ chấp nhận: {string.Join(", ", allowedExtensions)}");
        }

        // Ghép đường dẫn và đảm bảo kết quả vẫn nằm trong thư mục cho phép (chống tấn công "../")
        private string? SafeCombine(string baseFolder, string relativePath)
        {
            var baseFull = Path.GetFullPath(baseFolder).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            var full = Path.GetFullPath(Path.Combine(_webHostEnvironment.WebRootPath, relativePath.Replace("\\", "/").TrimStart('/')));
            return full.StartsWith(baseFull, StringComparison.OrdinalIgnoreCase) ? full : null;
        }

        private static string? ValidatePassword(string? password)
        {
            if (string.IsNullOrWhiteSpace(password) || password.Length < 8)
                return "Mật khẩu phải có ít nhất 8 ký tự.";
            if (!password.Any(char.IsLetter) || !password.Any(char.IsDigit))
                return "Mật khẩu phải có cả chữ và số.";
            return null;
        }

        public async Task<string> UploadAvatar(IFormFile file, string userId)
        {
            ValidateUpload(file, AvatarExtensions, MaxAvatarBytes);
            var user = await _context.Users.FindAsync(userId);
            if (user == null) throw new Exception("User không tồn tại");

            // Tạo thư mục riêng cho Avatar
            string folderPath = Path.Combine(_webHostEnvironment.WebRootPath, "uploads", "avatars");
            if (!Directory.Exists(folderPath)) Directory.CreateDirectory(folderPath);

            // Xóa ảnh cũ nếu đã tồn tại
            if (!string.IsNullOrEmpty(user.AvatarPath))
            {
                var oldPath = SafeCombine(Path.Combine(_webHostEnvironment.WebRootPath, "uploads", "avatars"), user.AvatarPath);
                if (oldPath != null && System.IO.File.Exists(oldPath))
                {
                    try { System.IO.File.Delete(oldPath); } catch { /* ignore */ }
                }
            }

            // Tạo tên file mới: avatar_userId_guid.jpg
            string fileName = $"avatar_{userId}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
            string relativePath = Path.Combine("uploads", "avatars", fileName).Replace("\\", "/");
            string fullPath = Path.Combine(_webHostEnvironment.WebRootPath, relativePath);

            using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Cập nhật database
            user.AvatarPath = relativePath;
            await _context.SaveChangesAsync();

            return relativePath;
        }

        public async Task<string> UploadContractFile(IFormFile file, string userId, string type)
        {
            if (type != "1" && type != "2" && type != "3") throw new InvalidOperationException("Loại hợp đồng không hợp lệ.");
            ValidateUpload(file, ContractExtensions, MaxContractBytes);
            var user = await _context.Users.FindAsync(userId);
            if (user == null) throw new Exception("User không tồn tại");

            string folderPath = Path.Combine(_webHostEnvironment.WebRootPath, "uploads", "contracts");
            if (!Directory.Exists(folderPath)) Directory.CreateDirectory(folderPath);

            string oldRelativePath = type switch
            {
                "1" => user.OfficialContractFile1,
                "2" => user.OfficialContractFile2,
                "3" => user.OfficialContractFile3,
                _ => null
            };

            if (!string.IsNullOrEmpty(oldRelativePath))
            {
                var fullOldPath = SafeCombine(folderPath, oldRelativePath);

                if (fullOldPath != null && System.IO.File.Exists(fullOldPath))
                {
                    try
                    {
                        System.IO.File.Delete(fullOldPath);
                    }
                    catch (Exception) {  }
                }
            }

            string fileName = $"{userId}_{type}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
            string relativePath = Path.Combine("uploads", "contracts", fileName).Replace("\\", "/");
            string fullPath = Path.Combine(_webHostEnvironment.WebRootPath, relativePath);

            using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            if (type == "1") user.OfficialContractFile1 = relativePath;
            else if (type == "2") user.OfficialContractFile2 = relativePath;
            else if (type == "3") user.OfficialContractFile3 = relativePath;

            await _context.SaveChangesAsync();
            return relativePath;
        }

        // --- Helper Methods ---
        public async Task<(byte[] Bytes, string ContentType, string FileName)> DownloadContractFile(string filePath)
        {
            var cleanPath = (filePath ?? string.Empty).Replace("\\", "/").TrimStart('/');
            // Chỉ cho tải file trong thư mục hợp đồng. Trước đây truyền "../appsettings.json" là tải được file cấu hình chứa mật khẩu DB!
            var absolutePath = SafeCombine(Path.Combine(_webHostEnvironment.WebRootPath, "uploads", "contracts"), cleanPath);

            if (absolutePath == null || !System.IO.File.Exists(absolutePath))
            {
                throw new FileNotFoundException("Không tìm thấy file trên server.");
            }

            var bytes = await System.IO.File.ReadAllBytesAsync(absolutePath);

            var extension = Path.GetExtension(cleanPath).ToLower();
            var fileName = Path.GetFileName(cleanPath);

            string contentType = extension switch
            {
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".doc" => "application/msword",
                ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".xls" => "application/vnd.ms-excel",
                ".pdf" => "application/pdf",
                _ => "application/octet-stream"
            };

            return (bytes, contentType, fileName);
        }
        private string GenerateJwtToken(IEnumerable<Claim> claims)
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Secret"]!));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.Now.AddDays(1),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public async Task<Response> ChangePassword(ChangePasswordDTO model)
        {
            var user = await _context.Users.FindAsync(model.UserId);
            if (user == null)
                return new Response { Code = 404, Message = "Người dùng không tồn tại." };

            // 1. Kiểm tra mật khẩu cũ
            if (!PasswordHasher.Verify(model.OldPassword, user.PasswordHash, out _))
            {
                return new Response { Code = 400, Message = "Mật khẩu cũ không chính xác." };
            }

            var passwordError = ValidatePassword(model.NewPassword);
            if (passwordError != null) return new Response { Code = 400, Message = passwordError };

            // 2. Cập nhật mật khẩu mới (PBKDF2 có salt)
            user.PasswordHash = PasswordHasher.Hash(model.NewPassword);
            await _context.SaveChangesAsync();

            return new Response { Code = 200, Message = "Đổi mật khẩu thành công." };
        }

        public async Task<Response> DeleteUser(string userId)
        {

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    var user = await _context.Users.FindAsync(userId);
                    if (user == null)
                        return new Response { Code = 404, Message = "Không tìm thấy nhân viên." };

 
                    var registrations = await _context.TaskRegistrations
                        .Where(r => r.UserId == userId)
                        .ToListAsync();

                    foreach (var reg in registrations)
                    {
                        var sections = await _context.TaskSections
                            .Where(s => s.RegistrationId == reg.Id)
                            .ToListAsync();

                        foreach (var sec in sections)
                        {
                            var items = _context.TaskItems.Where(i => i.SectionId == sec.Id);
                            _context.TaskItems.RemoveRange(items);
                        }

                        _context.TaskSections.RemoveRange(sections);
                    }
                    _context.TaskRegistrations.RemoveRange(registrations);

                    var leaveRequests = _context.LeaveRequests.Where(l => l.UserId == userId);
                    _context.LeaveRequests.RemoveRange(leaveRequests);


                    var quotas = _context.UserLeaveQuotas.Where(q => q.UserId == userId);
                    _context.UserLeaveQuotas.RemoveRange(quotas);


                    DeleteUserFiles(user);

                    _context.Users.Remove(user);

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return new Response { Code = 200, Message = "Đã xóa vĩnh viễn nhân sự và các dữ liệu liên quan." };
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return new Response { Code = 500, Message = $"Lỗi khi xóa dữ liệu liên kết: {ex.Message}" };
                }
            }
        }

        private void DeleteUserFiles(User user)
        {
            var filesToDelete = new List<string?>
    {
        user.AvatarPath,
        user.OfficialContractFile1,
        user.OfficialContractFile2,
        user.OfficialContractFile3
    };

            foreach (var relativePath in filesToDelete)
            {
                if (!string.IsNullOrEmpty(relativePath))
                {
                    var fullPath = SafeCombine(Path.Combine(_webHostEnvironment.WebRootPath, "uploads"), relativePath);
                    if (fullPath != null && System.IO.File.Exists(fullPath))
                    {
                        try { System.IO.File.Delete(fullPath); } catch { /* Bỏ qua nếu file đang bị lock */ }
                    }
                }
            }
        }
    }
}
