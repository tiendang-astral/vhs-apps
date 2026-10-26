using System.ComponentModel.DataAnnotations;

namespace VNEB.Models
{
    public class Specification
    {
        public string Id { get; set; } = Guid.NewGuid().ToString(); // Vẫn dùng GUID làm ID hệ thống
        public string AssetCode { get; set; } = string.Empty; // Mã chủng loại (Business Key)
        public string Name { get; set; } = string.Empty;
        public string? Group { get; set; }
        public string? Category { get; set; }
        public string? Phase { get; set; }
        public string? VoltageLevel { get; set; }
        public string? Manufacturer { get; set; }
        public string? Model { get; set; }
        public string? SerialNumber { get; set; }
        public int TotalQuantity { get; set; }
        public string? Unit { get; set; }
        public int Lifespan { get; set; }
        public string? ImageUrl { get; set; }
        public string? Note { get; set; }

        public virtual ICollection<InventoryStock> Stocks { get; set; } = new List<InventoryStock>();
        public virtual ICollection<OperatingEquipment> OperatingEquipments { get; set; } = new List<OperatingEquipment>();
    }
}

