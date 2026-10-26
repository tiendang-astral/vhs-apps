using System.ComponentModel.DataAnnotations;

public class Notification
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } 
    public string Content { get; set; } 
    public string Type { get; set; } 
    public bool IsRead { get; set; } = false; 
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public string? Link { get; set; } 
}