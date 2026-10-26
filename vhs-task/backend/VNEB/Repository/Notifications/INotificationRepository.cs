namespace VNEB.Repository.Notifications
{
    public interface INotificationRepository
    {
        Task SendAndSave(string userId, string message, string type, string link = "/");
        Task<List<Notification>> GetNotificationsAsync(string userId);
        Task<bool> MarkAsReadAsync(string notificationId, string userId);
    }
}
