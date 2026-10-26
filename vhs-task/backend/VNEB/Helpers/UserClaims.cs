using System.Security.Claims;

namespace VNEB.Helpers
{
    /// <summary>Đọc thông tin người dùng hiện tại từ token JWT.</summary>
    public static class UserClaims
    {
        public static readonly string[] ManagementRoles = { "ADMIN", "CHAIRMAN", "BOD" };

        public static string? GetUserId(this ClaimsPrincipal user) =>
            user.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        public static string GetRole(this ClaimsPrincipal user) =>
            (user.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty).ToUpperInvariant();

        public static string? GetDeptId(this ClaimsPrincipal user) =>
            user.FindFirst("DeptId")?.Value;

        public static bool HasRole(this ClaimsPrincipal user, params string[] roles) =>
            roles.Contains(user.GetRole(), StringComparer.OrdinalIgnoreCase);

        public static bool IsAdmin(this ClaimsPrincipal user) => user.HasRole("ADMIN");

        /// <summary>
        /// Có quyền quản lý hồ sơ nhân sự: Ban lãnh đạo (ADMIN/CHAIRMAN/BOD)
        /// hoặc nhân sự thuộc phòng HCNS (cấu hình "Security:HrDepartmentIds", mặc định phòng 7).
        /// </summary>
        public static bool IsHr(this ClaimsPrincipal user, IConfiguration config)
        {
            if (user.HasRole(ManagementRoles)) return true;
            var hrDepts = config.GetSection("Security:HrDepartmentIds").Get<string[]>() ?? new[] { "7" };
            var deptId = user.GetDeptId();
            return !string.IsNullOrEmpty(deptId) && hrDepts.Contains(deptId);
        }
    }
}
