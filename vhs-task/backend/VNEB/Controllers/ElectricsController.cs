using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VNEB.Models;
using VNEB.Repository.Electrics;

namespace VNEB.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize] // Bắt buộc đăng nhập
    public class ElectricsController : ControllerBase
    {
        private readonly IElectricRepository _repository;

        public ElectricsController(IElectricRepository repository)
        {
            _repository = repository;
        }

        // GET: api/Electrics
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var data = await _repository.GetAllUsageWithCustomerAsync();
            return Ok(data);
        }
        [HttpGet("by-month")]
        public async Task<IActionResult> GetByMonth(int year, int month)
        {
            var result = await _repository.GetUsageByMonthAsync(year, month);
            return Ok(result);
        }
        // POST: api/Electrics
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] ElectricityUsage usage)
        {
            if (usage == null) return BadRequest();

            // Tính toán lại tổng ở BE để đảm bảo an toàn dữ liệu
            usage.TotalConsumption = usage.P_FlatRate + usage.P_Normal + usage.P_Peak + usage.P_OffPeak;
            usage.TotalBillAmount = usage.Amount_FlatRate + usage.Amount_Normal + usage.Amount_Peak + usage.Amount_OffPeak;

            var result = await _repository.CreateAsync(usage);
            return result ? Ok(new { message = "Lưu thành công" }) : StatusCode(500);
        }

        // PUT: api/Electrics/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] ElectricityUsage usage)
        {
            if (id != usage.Id) return BadRequest();

            var result = await _repository.UpdateAsync(usage);
            return result ? Ok(new { message = "Cập nhật thành công" }) : StatusCode(500);
        }

        // DELETE: api/Electrics/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var result = await _repository.DeleteAsync(id);
            return result ? Ok(new { message = "Xóa thành công" }) : NotFound();
        }
    }
}