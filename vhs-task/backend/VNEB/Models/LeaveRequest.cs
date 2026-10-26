using System.ComponentModel.DataAnnotations;

namespace VNEB.Models
{
    public class LeaveRequest
    {
        [Key]
        public int Id { get; set; }
        public string UserId { get; set; } = string.Empty; 

        public string ConfirmationType { get; set; } = string.Empty; 
        public DateTime RequestDate { get; set; }
        public DateTime EndDate {get; set; }
        public string FromTime { get; set; } = string.Empty;
        public string ToTime { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;

        public string CurrentApproverRole { get; set; } = string.Empty; 
        public int Status { get; set; } = 0; 

        public string? ApprovedBy { get; set; } 
        public DateTime? ApprovedDate { get; set; }

        public virtual User? User { get; set; }
    }
}
