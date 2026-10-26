using Microsoft.EntityFrameworkCore;
using VNEB.Models;

namespace VNEB.Repository.Electrics
{
    public class ElectricRepository : IElectricRepository
    {
        private readonly VnebContext _context;

        public ElectricRepository(VnebContext context)
        {
            _context = context;
        }
        public async Task<IEnumerable<object>> GetUsageByMonthAsync(int year, int month)
        {
            return await _context.ElectricityUsages
                .Include(u => u.Customer)
                .Where(u => u.Year == year && u.Month == month) // Lọc theo tháng năm
                .Select(u => new {
                    u.Id,
                    u.CustomerId,
                    MaKhachHang = u.Customer.Id,
                    TenKhachHang = u.Customer.CustomerName,
                    Tinh = u.Customer.Province,
                    KcnCcn = u.Customer.IndustrialZone,
                    u.Year,
                    u.Month,
                    u.Price_FlatRate,
                    u.Price_Normal,
                    u.Price_Peak,
                    u.Price_OffPeak,
                    u.P_FlatRate,
                    u.P_Normal,
                    u.P_Peak,
                    u.P_OffPeak,
                    u.TotalConsumption,
                    u.Amount_FlatRate,
                    u.Amount_Normal,
                    u.Amount_Peak,
                    u.Amount_OffPeak,
                    u.TotalBillAmount
                })
                .ToListAsync();
        }
        public async Task<IEnumerable<object>> GetAllUsageWithCustomerAsync()
        {
            return await _context.ElectricityUsages
                .Include(u => u.Customer)
                .Select(u => new {
                    u.Id,
                    u.CustomerId,
                    MaKhachHang = u.Customer.Id, // Giả định field trong Model Customer
                    TenKhachHang = u.Customer.CustomerName,
                    Tinh = u.Customer.Province,
                    KcnCcn = u.Customer.IndustrialZone,
                    u.Year,
                    u.Month,
                    u.Price_FlatRate,
                    u.Price_Normal,
                    u.Price_Peak,
                    u.Price_OffPeak,
                    u.P_FlatRate,
                    u.P_Normal,
                    u.P_Peak,
                    u.P_OffPeak,
                    u.TotalConsumption,
                    u.Amount_FlatRate,
                    u.Amount_Normal,
                    u.Amount_Peak,
                    u.Amount_OffPeak,
                    u.TotalBillAmount
                })
                .ToListAsync();
        }
        private void CalculateTotals(ElectricityUsage usage)
        {
            usage.Amount_FlatRate = usage.Price_FlatRate * usage.P_FlatRate;
            usage.Amount_Normal = usage.Price_Normal * usage.P_Normal;
            usage.Amount_Peak = usage.Price_Peak * usage.P_Peak;
            usage.Amount_OffPeak = usage.Price_OffPeak * usage.P_OffPeak;

            usage.TotalConsumption = usage.P_FlatRate + usage.P_Normal + usage.P_Peak + usage.P_OffPeak;
            usage.TotalBillAmount = usage.Amount_FlatRate + usage.Amount_Normal + usage.Amount_Peak + usage.Amount_OffPeak;
        }
        public async Task<ElectricityUsage?> GetByIdAsync(string id)
        {
            return await _context.ElectricityUsages.FindAsync(id);
        }

        public async Task<bool> CreateAsync(ElectricityUsage usage)
        {
            usage.Id = Guid.NewGuid().ToString();
            CalculateTotals(usage);
            _context.ElectricityUsages.Add(usage);
            return await _context.SaveChangesAsync() > 0;
        }

        public async Task<bool> UpdateAsync(ElectricityUsage usage)
        {
            CalculateTotals(usage);
            _context.Entry(usage).State = EntityState.Modified;
            return await _context.SaveChangesAsync() > 0;
        }

        public async Task<bool> DeleteAsync(string id)
        {
            var usage = await _context.ElectricityUsages.FindAsync(id);
            if (usage == null) return false;
            _context.ElectricityUsages.Remove(usage);
            return await _context.SaveChangesAsync() > 0;
        }
    }
}