using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace VNEB.Models
{
    public class TaskRegistration
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string UserId { get; set; } = string.Empty;

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }

        public string Month { get; set; } = string.Empty; // Format: "YYYY-MM"

        // Statuses: DRAFT, PENDING_MANAGER, PENDING_BOD, APPROVED
        public string Status { get; set; } = "DRAFT";
        public virtual ICollection<TaskSection> TaskSections { get; set; } = new List<TaskSection>();
        public virtual ICollection<TaskItem> TaskItems { get; set; } = new List<TaskItem>();
    }
}
