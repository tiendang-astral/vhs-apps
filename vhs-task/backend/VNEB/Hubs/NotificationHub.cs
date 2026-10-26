using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace VNEB.Hubs
{
    [Authorize]
    public class NotificationHub : Hub
    {
        // Token JWT lưu Id người dùng ở claim NameIdentifier (không có claim "UserId"),
        // nên trước đây người dùng không bao giờ được thêm vào group => không nhận được thông báo realtime.
        private string? CurrentUserId =>
            Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? Context.User?.FindFirst("UserId")?.Value;

        public override async Task OnConnectedAsync()
        {
            var userId = CurrentUserId;
            if (!string.IsNullOrEmpty(userId))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, userId);
            }
            await base.OnConnectedAsync();
        }

        // Frontend gọi connection.invoke("JoinGroup", userId) – trước đây hub chưa có hàm này nên luôn báo lỗi.
        // Chỉ cho phép tham gia group của chính mình.
        public async Task JoinGroup(string userId)
        {
            if (!string.IsNullOrEmpty(userId) && userId == CurrentUserId)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, userId);
            }
        }
    }
}
