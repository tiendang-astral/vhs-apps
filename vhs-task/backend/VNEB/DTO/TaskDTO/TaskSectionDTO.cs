namespace VNEB.DTO.TaskDTO
{
    public class TaskSectionDTO
    {
        public string? Id { get; set; }
        public string Category { get; set; } = string.Empty; // A, B, C
        public string SectionName { get; set; } = string.Empty; // Tên hạng mục to
        public int PersonalWeight { get; set; } // Trọng số hạng mục (Cá nhân)
        public int ManagerWeight { get; set; }  // Trọng số hạng mục (Quản lý)

        public List<TaskItemDTO> TaskItems { get; set; } = new List<TaskItemDTO>();
    }
}
