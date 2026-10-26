using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace VNEB.Models
{
    public class ElectricityUsage
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        // Foreign Key trỏ thẳng tới CustomerId (Chính là Mã khách hàng)
        public string CustomerId { get; set; } = string.Empty;

        public int Year { get; set; }
        public int Month { get; set; }

        // Prices & Consumption
        public decimal Price_FlatRate { get; set; }
        public decimal Price_Normal { get; set; }
        public decimal Price_Peak { get; set; }
        public decimal Price_OffPeak { get; set; }

        public decimal P_FlatRate { get; set; }
        public decimal P_Normal { get; set; }
        public decimal P_Peak { get; set; }
        public decimal P_OffPeak { get; set; }
        public decimal TotalConsumption { get; set; }

        // Totals
        public decimal Amount_FlatRate { get; set; }
        public decimal Amount_Normal { get; set; }
        public decimal Amount_Peak { get; set; }
        public decimal Amount_OffPeak { get; set; }
        public decimal TotalBillAmount { get; set; }

        [ForeignKey("CustomerId")]
        public virtual Customer? Customer { get; set; }
    }
}
