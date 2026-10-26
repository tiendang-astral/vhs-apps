using System.ComponentModel.DataAnnotations;

namespace VNEB.Models
{
    public class UserLeaveQuota
    {
        [Key]
        public int Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public double RemainingLastYear { get; set; } // Số phép tồn
        public double NewQuota { get; set; }          // Số phép mới
        public double UsedPaidLeave { get; set; }     // Nghỉ tích lũy
        public int LateEarlyCount { get; set; }       // Đi sớm/Về muộn
        public double UnpaidLeave { get; set; }       // Nghỉ không lương
        public double SpecialLeave { get; set; }      // Nghỉ chế độ
        public virtual User? User { get; set; }
    }
}
