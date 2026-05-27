using MyApp.Services;
using MyApp.Models;
namespace MyApp.Controllers;
public class UserController { private readonly UserService _svc; public UserController(UserService svc) { _svc = svc; } }