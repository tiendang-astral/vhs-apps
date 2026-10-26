using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace VNEB.Models
{
    public class Department
    {
        [Key]
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public int? ParentId { get; set; }

        [ForeignKey("ParentId")]
        public virtual Department? Parent { get; set; }
        public virtual ICollection<User> Users { get; set; } = new List<User>();
    }
}
