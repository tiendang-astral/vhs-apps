using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using VNEB.Models;
using VNEB.Repository.LeaveRequests;
using VNEB.Responses;

namespace VNEB.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize] // Bắt buộc đăng nhập
    public class LeaveRequestsController : ControllerBase
    {
        private readonly ILeaveRequestRepository _leaveRepo;

        public LeaveRequestsController(ILeaveRequestRepository leaveRepo)
        {
            _leaveRepo = leaveRepo;
        }

        [HttpPost("create")]
        public async Task<IActionResult> Create([FromBody] LeaveRequest request)
        {
            if (request == null) return BadRequest(new Response { Code = 400, Message = "Dữ liệu không hợp lệ" });

            var res = await _leaveRepo.Create(request);
            return Ok(res);
        }

        [HttpPost("approve")]
        public async Task<IActionResult> Approve(int requestId, string? approverRole)
        {
            // Lấy vai trò từ token, KHÔNG tin tham số approverRole do trình duyệt gửi lên
            // (trước đây nhân viên có thể tự gửi approverRole=CHAIRMAN để duyệt đơn)
            var roleFromToken = User.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty;
            var res = await _leaveRepo.Approve(requestId, roleFromToken);
            return Ok(res);
        }

        [HttpGet("get-approvals")]
        public async Task<IActionResult> GetForApprover()
        {
  
            var res = await _leaveRepo.GetForApprover();
            return Ok(res);
        }

        [HttpGet("my-requests")]
        public async Task<IActionResult> GetByUser()
        {
            var res = await _leaveRepo.GetByUser();
            return Ok(res);
        }

        [HttpGet("statistical")]
        public async Task<IActionResult> GetStatistical([FromQuery] string? company, [FromQuery] int? deptId)
        {
            var res = await _leaveRepo.GetStatisticalForHR(company, deptId);
            return Ok(res);
        }
        [HttpGet("quota-report")]
        public async Task<IActionResult> GetQuotaReport(string? company, int? deptId)
        {
            var response = await _leaveRepo.GetUserLeaveQuotaReport(company, deptId);
            return Ok(response);
        }

        [HttpPost("update-quota")]
        public async Task<IActionResult> UpdateQuota([FromBody] UserLeaveQuota quota)
        {
            var response = await _leaveRepo.UpdateLeaveQuota(quota);
            return Ok(response);
        }
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var res = await _leaveRepo.Delete(id);
            return Ok(res);
        }

        [HttpPost("reject/{id}")]
        public async Task<IActionResult> Reject(int id, [FromBody] string reason)
        {
            var result = await _leaveRepo.Reject(id, reason);
            if (result.Code == 200) return Ok(result);
            return BadRequest(result);
        }
    }
}