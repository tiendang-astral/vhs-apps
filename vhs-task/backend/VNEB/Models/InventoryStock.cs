using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace VNEB.Models
{
    public class InventoryStock
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string AssetCode { get; set; } = string.Empty;
        public string UniqueAssetId { get; set; } = string.Empty;
        public string EquipmentName { get; set; } = string.Empty;
        public string WarehouseName { get; set; } = string.Empty;
        public int CurrentStock { get; set; }
        public string? Condition { get; set; }
        public int MinStockLevel { get; set; }
        public string? WarningStatus { get; set; }
        public string? LastUpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? Notes { get; set; }

        [ForeignKey("AssetCode")]
        public virtual Specification? Specification { get; set; }
    }
}
