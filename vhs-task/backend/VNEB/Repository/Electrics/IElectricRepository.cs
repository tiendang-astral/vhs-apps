using VNEB.Models;

namespace VNEB.Repository.Electrics
{
    public interface IElectricRepository
    {
        Task<IEnumerable<object>> GetUsageByMonthAsync(int year, int month);
        Task<IEnumerable<object>> GetAllUsageWithCustomerAsync();
        Task<ElectricityUsage?> GetByIdAsync(string id);
        Task<bool> CreateAsync(ElectricityUsage usage);
        Task<bool> UpdateAsync(ElectricityUsage usage);
        Task<bool> DeleteAsync(string id);
    }
}
