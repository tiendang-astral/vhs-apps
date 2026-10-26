namespace VNEB.DTO.SpecificationDTO
{
    public class SpecificationDTO
    {
        public string Asset { get; set; }        // Cột Asset tự động sinh từ FE
        public string Name { get; set; }         // Tên thiết bị tự động sinh từ FE
        public string Nhom { get; set; }         // Nhóm thiết bị (Group)
        public string ChungLoai { get; set; }    // Chủng loại (Category)
        public string Phase { get; set; }        // 1P/3P
        public string CapDienAp { get; set; }    // VoltageLevel
        public string? HangSx { get; set; }      // Manufacturer
        public string? Model { get; set; }
        public string? Serial { get; set; }      // SerialNumber
        public int TongSoLuong { get; set; }     // TotalQuantity
        public string DonVi { get; set; }        // Unit
        public int TuoiTho { get; set; }         // Lifespan
        public string? HinhAnh { get; set; }     // ImageUrl
        public string? GhiChu { get; set; }      // Note
    }
}
