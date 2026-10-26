using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using VNEB.Hubs;
using VNEB.Models;

namespace VNEB.Repository.Notifications
{
    public class NotificationRepository :INotificationRepository
    {
        private readonly VnebContext _context; // DB Context
        private readonly IHubContext<NotificationHub> _hubContext;

        public NotificationRepository(VnebContext context, IHubContext<NotificationHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        public async Task SendAndSave(string userId, string message, string type , string link = "/")
        {
            var noti = new Notification
            {
                UserId = userId,
                Content = message,
                Type = type, // Bây giờ 'type' đã được nhận vào tham số
                IsRead = false,
                CreatedAt = DateTime.Now,
                Link = link
            };

            _context.Notifications.Add(noti);
            await _context.SaveChangesAsync();

            // Bắn SignalR
            await _hubContext.Clients.Group(userId).SendAsync("ReceiveNotification", new
            {
                id = noti.Id,
                message = noti.Content,
                type = noti.Type,
                time = noti.CreatedAt,
                isRead = false,
                link = noti.Link
            });
        }
        public async Task<bool> MarkAsReadAsync(string notificationId, string userId)
        {
            // Tìm thông báo theo ID và phải thuộc về đúng User đó
            var noti = await _context.Notifications
                .FirstOrDefaultAsync(n => n.Id == notificationId && n.UserId == userId);

            if (noti == null) return false; // Không tìm thấy hoặc không có quyền

            noti.IsRead = true;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<List<Notification>> GetNotificationsAsync(string userId)
        {
            // Chỉ lấy 100 thông báo gần nhất, không cần tracking vì chỉ đọc
            return await _context.Notifications
                .AsNoTracking()
                .Where(n => n.UserId == userId)
                .OrderByDescending(n => n.CreatedAt)
                .Take(100)
                .ToListAsync();
        }
    }
}
