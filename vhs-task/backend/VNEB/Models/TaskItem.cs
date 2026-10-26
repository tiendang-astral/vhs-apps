using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace VNEB.Models
{
    public class TaskItem
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        // FK trỏ về Section thay vì Registration trực tiếp
        public string SectionId { get; set; } = string.Empty;
        [ForeignKey("SectionId")]
        public virtual TaskSection? TaskSection { get; set; }

        public string TaskDescription { get; set; } = string.Empty;
        public string StartDate { get; set; } = string.Empty;
        public string EndDate { get; set; } = string.Empty;

        // Các thông tin chi tiết của nhiệm vụ
        public string ExpectedOutcome { get; set; } = string.Empty;
        public string PersonalTarget { get; set; } = string.Empty;
        public string PersonalResult { get; set; } = string.Empty;
        public string PersonalPriority { get; set; } = "Medium";
        public string PersonalComplexity { get; set; } = "Normal";
        public string Note {  get; set; } = string.Empty;

        public string ManagerTarget { get; set; } = string.Empty;
        public string ManagerResult { get; set; } = string.Empty;
        public string ManagerPriority { get; set; } = "Medium";
        public string ManagerComplexity { get; set; } = "Normal";
    }
}