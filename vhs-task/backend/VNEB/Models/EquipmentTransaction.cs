namespace VNEB.Models
{
    public class EquipmentTransaction
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string TransactionDate { get; set; } = string.Empty;
        public string AssetCode { get; set; } = string.Empty;
        public string UniqueAssetId { get; set; } = string.Empty;
        public string EquipmentName { get; set; } = string.Empty;
        public string TransactionType { get; set; } = string.Empty; // In, Out, Transfer
        public int Quantity { get; set; }
        public string? FromWarehouse { get; set; }
        public string? ToWarehouse { get; set; }
        public string? ExportedBy { get; set; }
        public string? ReceivedBy { get; set; }
        public string? Reason { get; set; }
        public string? DocumentRef { get; set; }
    }
}
