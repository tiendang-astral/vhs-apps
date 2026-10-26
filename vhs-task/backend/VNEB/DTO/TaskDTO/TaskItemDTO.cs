namespace VNEB.DTO.TaskDTO
{
    public class TaskItemDTO
    {
        public string? Id { get; set; }
        public string TaskDescription { get; set; } = string.Empty;
        public string StartDate { get; set; } = string.Empty;
        public string EndDate { get; set; } = string.Empty;

        public string ExpectedOutcome { get; set; } = string.Empty;
        public string PersonalTarget { get; set; } = string.Empty;
        public string ManagerTarget { get; set; } = string.Empty;
        public string PersonalResult { get; set; } = string.Empty;
        public string ManagerResult { get; set; } = string.Empty;
        public string PersonalPriority { get; set; } = string.Empty;
        public string ManagerPriority { get; set; } = string.Empty;
        public string PersonalComplexity { get; set; } = string.Empty;
        public string ManagerComplexity { get; set; } = string.Empty;
        public string Note { get; set; } = string.Empty;
    }
}
