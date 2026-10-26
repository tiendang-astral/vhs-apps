namespace VNEB.DTO.TaskDTO
{
    public class TaskApprovalDto
    {
        public string UserId { get; set; }
        public string FullName { get; set; }
        public string Role { get; set; }
        public int DepartmentId { get; set; } // Thêm mới
        public string DepartmentName { get; set; }
        public string CompanyName { get; set; } // Thêm mới (nếu cần hiển thị)
        public string Month { get; set; }
        public string Status { get; set; }
    }
}
