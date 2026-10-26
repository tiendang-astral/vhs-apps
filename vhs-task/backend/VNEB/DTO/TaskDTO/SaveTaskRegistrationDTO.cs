namespace VNEB.DTO.TaskDTO
{
    public class SaveTaskRegistrationDTO
    {
        public string UserId { get; set; } = string.Empty;
        public string Month { get; set; } = string.Empty;
        public string Status { get; set; } = "DRAFT";

        // Đổi từ List<TaskItemDTO> sang List<TaskSectionDTO>
        public List<TaskSectionDTO> TaskSections { get; set; } = new List<TaskSectionDTO>();
    }
}
