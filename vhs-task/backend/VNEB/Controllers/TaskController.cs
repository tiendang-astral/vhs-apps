using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using VNEB.DTO.TaskDTO;
using VNEB.Repository.Tasks;
using VNEB.Responses;

namespace VNEB.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class TaskController : ControllerBase
    {
        private readonly ITaskRepository _taskRepo;

        public TaskController(ITaskRepository taskRepo)
        {
            _taskRepo = taskRepo;
        }

        private string? CurrentUserId => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        private string CurrentUserRole => User.FindFirst(ClaimTypes.Role)?.Value ?? "STAFF";

        // Được xem/sửa nhiệm vụ của userId: chính chủ hoặc cấp quản lý
        private bool CanAccessUser(string userId) =>
            userId == CurrentUserId || TaskRepository.ApproverRoles.Contains(CurrentUserRole);

        private IActionResult NoPermission() =>
            Ok(new Response { Code = 403, Message = "Bạn không có quyền truy cập nhiệm vụ của người khác" });

        [HttpGet("{userId}/{month}")]
        public async Task<IActionResult> Get(string userId, string month)
        {
            if (!CanAccessUser(userId)) return NoPermission();
            return Ok(await _taskRepo.GetTasksAsync(userId, month));
        }

        [HttpPost("save")]
        public async Task<IActionResult> Save([FromBody] SaveTaskRegistrationDTO dto)
        {
            if (!CanAccessUser(dto.UserId)) return NoPermission();
            return Ok(await _taskRepo.SaveTasksAsync(dto, CurrentUserId, CurrentUserRole));
        }

        [HttpGet("approvals/{bossId}")]
        public async Task<IActionResult> GetApprovals(string bossId, [FromQuery] string? month)
        {
            // Chỉ xem được danh sách cấp dưới của chính mình
            if (bossId != CurrentUserId && !string.Equals(CurrentUserRole, "ADMIN", StringComparison.OrdinalIgnoreCase))
                return NoPermission();
            month = string.IsNullOrWhiteSpace(month) ? DateTime.Now.ToString("yyyy-MM") : month;
            return Ok(await _taskRepo.GetSubordinatesTasksAsync(bossId, month));
        }

        [HttpPost("approve-action")]
        public async Task<IActionResult> ApproveAction([FromBody] ApprovalActionDTO dto)
        {
            // Chặn ở server: chỉ cấp quản lý mới được duyệt / trả lại (trước đây ai đăng nhập cũng gọi được)
            if (!TaskRepository.ApproverRoles.Contains(CurrentUserRole))
                return Ok(new Response { Code = 403, Message = "Bạn không có quyền phê duyệt nhiệm vụ" });

            return Ok(await _taskRepo.ApproveOrRejectTaskAsync(dto.RegistrationId, dto.Action, CurrentUserRole));
        }

        [HttpGet("performance/personal")]
        public async Task<IActionResult> GetPersonalStats(
            [FromQuery] string? userId,
            [FromQuery] int? deptId,
            [FromQuery] DateTime fromDate,
            [FromQuery] DateTime toDate)
        {
            return Ok(await _taskRepo.GetPerformanceStatsAsync(userId, deptId, fromDate, toDate));
        }
    }
}
