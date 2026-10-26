using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VNEB.Models;
using VNEB.Repository.Customers;

namespace VNEB.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize] // Bắt buộc đăng nhập
    public class CustomersController : ControllerBase
    {
        private readonly ICustomerRepository _repo;
        public CustomersController(ICustomerRepository repo) => _repo = repo;

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Customer>>> GetCustomers()
            => Ok(await _repo.GetAllAsync());

        [HttpPost]
        public async Task<ActionResult<Customer>> PostCustomer(Customer customer)
        {
            var created = await _repo.CreateAsync(customer);
            return CreatedAtAction(nameof(GetCustomers), new { id = created.Id }, created);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutCustomer(string id, Customer customer)
        {
            if (id != customer.Id) return BadRequest();
            await _repo.UpdateAsync(customer);
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCustomer(string id)
        {
            await _repo.DeleteAsync(id);
            return NoContent();
        }
    }
}