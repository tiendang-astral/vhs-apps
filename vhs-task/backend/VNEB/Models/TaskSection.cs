using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace VNEB.Models
{
    public class TaskSection
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        public string RegistrationId { get; set; } = string.Empty;
        [ForeignKey("RegistrationId")]
        public virtual TaskRegistration? TaskRegistration { get; set; }

        public string Category { get; set; } = string.Empty;
        public string SectionName { get; set; } = string.Empty;

        // Quan hệ 1 hạng mục có nhiều nhiệm vụ con
        public virtual ICollection<TaskItem> TaskItems { get; set; } = new List<TaskItem>();
    }
}