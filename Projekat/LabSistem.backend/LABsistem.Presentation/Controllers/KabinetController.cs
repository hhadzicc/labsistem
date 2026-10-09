using LABsistem.Api.Services;
using LABsistem.Application.DTOs;
using LABsistem.Domain;
using LABsistem.Presentation.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace LABsistem.Presentation.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class KabinetController : ControllerBase
    {
        private readonly IKabinetService _service;
        private readonly IDemoAccessGuard _demoAccessGuard;

        public KabinetController(IKabinetService service, IDemoAccessGuard demoAccessGuard)
        {
            _service = service;
            _demoAccessGuard = demoAccessGuard;
        }

        [HttpGet]
        [Authorize(Roles = "Admin,Profesor,Tehnicar")]
        public async Task<IActionResult> Get()
        {
            var cabinets = (await _service.VratiSveKabinete()).ToList();
            if (!IsDemoUser()) return Ok(cabinets);

            var allowedIds = await _demoAccessGuard.GetDemoCabinetIdsAsync(cabinets.Select(item => item.ID));
            return Ok(cabinets.Where(item => allowedIds.Contains(item.ID)));
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Post([FromBody] KabinetCreateDTO dto)
        {
            await _service.KreirajKabinet(dto);
            return Ok(new { message = "Kabinet uspjesno dodan" });
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Put(int id, [FromBody] KabinetCreateDTO dto)
        {
            await _service.AzurirajKabinet(id, dto);
            return Ok(new { message = "Kabinet azuriran" });
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            await _service.ObrisiKabinet(id);
            return Ok(new { message = "Kabinet obrisan" });
        }

        [HttpGet("{id}")]
        [Authorize(Roles = "Admin,Profesor,Tehnicar")]
        public async Task<IActionResult> GetById(int id)
        {
            if (IsDemoUser() && !await _demoAccessGuard.IsDemoCabinetAsync(id)) return Forbid();

            var kabinet = await _service.VratiKabinetPoId(id);
            if (kabinet == null)
                return NotFound(new { message = "Kabinet nije pronađen" });
            
            return Ok(kabinet);
        }

        private bool IsDemoUser() =>
            DemoAccounts.IsDemoUsername(User.FindFirstValue(ClaimTypes.Name));
    }
}
