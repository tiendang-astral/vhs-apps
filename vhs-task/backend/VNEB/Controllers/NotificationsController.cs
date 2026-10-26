using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using VNEB.Models;
using VNEB.Repository.Notifications;

namespace VNEB.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize] // Bắt buộc đăng nhập
    public class NotificationsController : Controller
    {
        private readonly INotificationRepository _notiRepo;

        public NotificationsController(INotificationRepository notiRepo)
        {
            _notiRepo = notiRepo;
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetMyNotifications()
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized("Không tìm thấy thông tin người dùng");
            }

            var notifications = await _notiRepo.GetNotificationsAsync(userId);
            return Ok(notifications);
        }

        // API đánh dấu đã đọc (Option)
        [HttpPost("read/{id}")]
        public async Task<IActionResult> MarkAsRead(string id)
        {
            // Lấy userId từ Token (giả định bạn đang dùng JWT)
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value.ToString();

            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var success = await _notiRepo.MarkAsReadAsync(id, userId);

            if (!success) return NotFound("Thông báo không tồn tại hoặc bạn không có quyền.");

            return Ok(new { message = "Đã đánh dấu là đã đọc" });
        }
    }
}
