using System.ComponentModel.DataAnnotations;

namespace VNEB.Models
{
    public class Customer
    {
        [Key]
        public string Id { get; set; } = string.Empty;
        public string? Province { get; set; }
        public string? IndustrialZone { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string? Address { get; set; }
        public string? ContractSigningDate { get; set; }
        public string? ContractExpiryDate { get; set; }
        public string? TaxCode { get; set; }
        public string? BankAccountNumber { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? UsageLocation { get; set; }
        public string? ConnectionPoint { get; set; }
        public string? UsagePurpose { get; set; }
        public string? VoltageLevel { get; set; }
        public string? MaxPower { get; set; }
        public string? AvgDailyPower { get; set; }
        public string? MinPower { get; set; }
        public string? RegisteredVolume { get; set; }
        public string? LegalDocuments { get; set; }

        public virtual ICollection<ElectricityUsage> ElectricityUsages { get; set; } = new List<ElectricityUsage>();
    }
}
