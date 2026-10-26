using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace VNEB.Models
{
    public class OperatingEquipment
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string AssetCode { get; set; } = string.Empty;
        public string UniqueAssetId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public string? Location { get; set; }
        public string? WiringDiagram { get; set; }
        public string? EquipmentType { get; set; }
        public string? Phase { get; set; }
        public string? Voltage { get; set; }
        public string? Unit { get; set; }
        public string? StartDate { get; set; }
        public string? LastInspectionDate { get; set; }
        public string? NextInspectionDate { get; set; }
        public int InspectionCycleMonths { get; set; }
        public string? Manager { get; set; }
        public string? ImageUrl { get; set; }
        public string? Notes { get; set; }

        [ForeignKey("AssetCode")]
        public virtual Specification? Specification { get; set; }
    }
}
