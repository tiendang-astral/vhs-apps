using Microsoft.EntityFrameworkCore;
using VNEB.DTO.SpecificationDTO;
using VNEB.Models;
using VNEB.Responses;

namespace VNEB.Repository.Specifications
{
    public class SpecificationRepository : ISpecificationRepository
    {
        private readonly VnebContext _context;
        public SpecificationRepository(VnebContext context) => _context = context;

        public async Task<Response> GetAll()
        {
            var data = await _context.Specifications.OrderByDescending(x => x.AssetCode).ToListAsync();
            return new Response { Code = 200, Data = data };
        }

        public async Task<Response> Create(SpecificationDTO dto)
        {
            try
            {
                var spec = new Specification
                {
                    Id = Guid.NewGuid().ToString(),
                    AssetCode = dto.Asset,
                    Name = dto.Name,
                    Group = dto.Nhom,
                    Category = dto.ChungLoai,
                    Phase = dto.Phase,
                    VoltageLevel = dto.CapDienAp,
                    Manufacturer = dto.HangSx,
                    Model = dto.Model,
                    SerialNumber = dto.Serial,
                    TotalQuantity = dto.TongSoLuong,
                    Unit = dto.DonVi,
                    Lifespan = dto.TuoiTho,
                    ImageUrl = dto.HinhAnh,
                    Note = dto.GhiChu
                };
                _context.Specifications.Add(spec);
                await _context.SaveChangesAsync();
                return new Response { Code = 200, Message = "Thêm mới thành công!" };
            }
            catch (Exception ex)
            {
                return new Response { Code = 500, Message = ex.Message };
            }
        }

        public async Task<Response> Update(string id, SpecificationDTO dto)
        {
            var spec = await _context.Specifications.FindAsync(id);
            if (spec == null) return new Response { Code = 404, Message = "Không tìm thấy!" };

            spec.AssetCode = dto.Asset;
            spec.Name = dto.Name;
            spec.Group = dto.Nhom;
            spec.Category = dto.ChungLoai;
            spec.Phase = dto.Phase;
            spec.VoltageLevel = dto.CapDienAp;
            spec.Manufacturer = dto.HangSx;
            spec.Model = dto.Model;
            spec.SerialNumber = dto.Serial;
            spec.TotalQuantity = dto.TongSoLuong;
            spec.Unit = dto.DonVi;
            spec.Lifespan = dto.TuoiTho;
            spec.ImageUrl = dto.HinhAnh;
            spec.Note = dto.GhiChu;

            await _context.SaveChangesAsync();
            return new Response { Code = 200, Message = "Cập nhật thành công!" };
        }

        public async Task<Response> Delete(string id)
        {
            var spec = await _context.Specifications.FindAsync(id);
            if (spec == null) return new Response { Code = 404, Message = "Không tìm thấy!" };

            _context.Specifications.Remove(spec);
            await _context.SaveChangesAsync();
            return new Response { Code = 200, Message = "Xóa thành công!" };
        }
    }
}
