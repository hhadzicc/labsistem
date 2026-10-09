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
    public class TerminController : ControllerBase
    {
        private readonly ITerminService _service;
        private readonly IDemoAccessGuard _demoAccessGuard;

        public TerminController(ITerminService service, IDemoAccessGuard demoAccessGuard)
        {
            _service = service;
            _demoAccessGuard = demoAccessGuard;
        }

        [HttpGet]
        [Authorize(Roles = "Admin,Profesor,Tehnicar,Student")]
        public async Task<IActionResult> Get()
        {
            var terms = (await _service.VratiSveTermine()).ToList();
            if (!IsDemoUser()) return Ok(terms);

            var allowedIds = await _demoAccessGuard.GetDemoTermIdsAsync(terms.Select(item => item.ID));
            return Ok(terms.Where(item => allowedIds.Contains(item.ID)));
        }

        [HttpPost]
        [Authorize(Roles = "Admin,Tehnicar")]
        public async Task<IActionResult> Post([FromBody] TerminCreateDTO dto)
        {
            if (IsDemoUser())
            {
                if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
                if (!await _demoAccessGuard.IsDemoCabinetAsync(dto.KabinetID)) return Forbid();
                dto.KreatorID = userId;
            }

            try
            {
                await _service.KreirajTermin(dto);
                return Ok(new { message = "Termin uspjesno dodan" });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Tehnicar")]
        public async Task<IActionResult> Put(int id, [FromBody] TerminCreateDTO dto)
        {
            if (IsDemoUser())
            {
                if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
                if (!await _demoAccessGuard.IsDemoTermAsync(id) ||
                    !await _demoAccessGuard.IsDemoCabinetAsync(dto.KabinetID)) return Forbid();
                dto.KreatorID = userId;
            }

            try
            {
                var updated = await _service.AzurirajTermin(id, dto);
                if (!updated)
                {
                    return NotFound(new { message = "Termin nije pronadjen." });
                }

                return Ok(new { message = "Termin azuriran" });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Tehnicar")]
        public async Task<IActionResult> Delete(int id)
        {
            if (IsDemoUser() && !await _demoAccessGuard.IsDemoTermAsync(id)) return Forbid();

            await _service.ObrisiTermin(id);
            return Ok(new { message = "Termin obrisan" });
        }

        private bool IsDemoUser() =>
            DemoAccounts.IsDemoUsername(User.FindFirstValue(ClaimTypes.Name));

        private bool TryGetCurrentUserId(out int userId) =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);
    }
}
