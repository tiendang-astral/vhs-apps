using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using VNEB.Hubs;
using VNEB.Models;
using VNEB.Repository.Customers;
using VNEB.Repository.Departments;
using VNEB.Repository.Electrics;
using VNEB.Repository.LeaveRequests;
using VNEB.Repository.Notifications;
using VNEB.Repository.Specifications;
using VNEB.Repository.Tasks;
using VNEB.Repository.Users;

var builder = WebApplication.CreateBuilder(args);

// --- 0. Cấu hình bí mật (mật khẩu DB, khóa JWT) KHÔNG để trong appsettings.json ---
// Thứ tự ưu tiên (sau ghi đè trước): appsettings.json < appsettings.Local.json < biến môi trường.
// Trên server nên dùng biến môi trường:
//   ConnectionStrings__SEP490_G49="Server=...;uid=...;pwd=...;database=ManagementDB;TrustServerCertificate=True"
//   JWT__Secret="<chuỗi ngẫu nhiên tối thiểu 32 ký tự>"
builder.Configuration
    .AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true)
    .AddEnvironmentVariables();

var connectionString = builder.Configuration.GetConnectionString("SEP490_G49");
var jwtSecret = builder.Configuration["JWT:Secret"];
if (string.IsNullOrWhiteSpace(connectionString))
    throw new InvalidOperationException(
        "Thiếu chuỗi kết nối DB 'ConnectionStrings:SEP490_G49'. Hãy khai báo trong appsettings.Local.json hoặc biến môi trường ConnectionStrings__SEP490_G49.");
if (string.IsNullOrWhiteSpace(jwtSecret) || jwtSecret.Length < 32)
    throw new InvalidOperationException(
        "Thiếu hoặc quá ngắn khóa 'JWT:Secret' (tối thiểu 32 ký tự). Hãy khai báo trong appsettings.Local.json hoặc biến môi trường JWT__Secret.");


// CORS: có thể giới hạn domain qua cấu hình "Cors:AllowedOrigins" trong appsettings.json.
// Nếu không cấu hình thì cho phép mọi origin như trước, nhưng có hỗ trợ credentials
// (SignalR bắt buộc cần, AllowAnyOrigin() + credentials bị trình duyệt chặn).
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()?.Where(o => !string.IsNullOrWhiteSpace(o)).ToArray() ?? Array.Empty<string>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        if (allowedOrigins.Length > 0)
            policy.WithOrigins(allowedOrigins);
        else
            policy.SetIsOriginAllowed(_ => true);

        policy.AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// Nén response (JSON danh sách nhiệm vụ, thống kê...) giúp tải nhanh hơn qua internet
builder.Services.AddResponseCompression();
builder.Services.AddDbContext<VnebContext>(options =>
    options.UseSqlServer(connectionString));
builder.Services.AddSignalR();
builder.Services.AddEndpointsApiExplorer();

// --- 2. Cấu hình Swagger ---
builder.Services.AddSwaggerGen(option =>
{
    option.SwaggerDoc("v1", new OpenApiInfo { Title = "API", Version = "v1" });
    option.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        In = ParameterLocation.Header,
        Description = "Please enter a valid token",
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        BearerFormat = "JWT",
        Scheme = "Bearer"
    });
    option.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type=ReferenceType.SecurityScheme, Id="Bearer" }
            },
            new string[]{}
        }
    });
});

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Tự động bỏ qua các vòng lặp khi chuyển đổi sang JSON
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        // Chỉ format JSON đẹp khi chạy Development (production trả JSON gọn, nhẹ hơn)
        options.JsonSerializerOptions.WriteIndented = builder.Environment.IsDevelopment();
    });

// --- 3. Cấu hình Authentication & JWT ---
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
{
    options.SaveToken = true;
    options.RequireHttpsMetadata = false;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ClockSkew = TimeSpan.Zero,
        ValidAudience = builder.Configuration["JWT:Audience"],
        ValidIssuer = builder.Configuration["JWT:Issuer"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
    };

    // SignalR (WebSocket) không gửi được header Authorization, token được gửi qua query "access_token"
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            if (!string.IsNullOrEmpty(accessToken) &&
                context.HttpContext.Request.Path.StartsWithSegments("/notificationHub"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});
builder.Services.AddHttpContextAccessor();

// Giới hạn đăng nhập: tối đa 10 lần/phút cho mỗi địa chỉ IP (chống dò mật khẩu)
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("login", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<ISpecificationRepository, SpecificationRepository>();
builder.Services.AddScoped<ITaskRepository, TaskRepository>();
builder.Services.AddScoped<IDepartmentRepository, DepartmentRepository>();
builder.Services.AddScoped<ILeaveRequestRepository, LeaveRequestRepository>();
builder.Services.AddScoped<ICustomerRepository, CustomerRepository>();
builder.Services.AddScoped<IElectricRepository, ElectricRepository>();
builder.Services.AddScoped<INotificationRepository, NotificationRepository>();

var app = builder.Build();

// --- 4. Cấu hình Middleware Pipeline (Thứ tự cực kỳ quan trọng) ---
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.UseResponseCompression();
app.UseCors("AllowAll");

// Chặn truy cập trực tiếp file hợp đồng lao động qua URL (/uploads/contracts/...).
// File hợp đồng chỉ tải được qua API /api/Users/download-contract (bắt buộc đăng nhập + quyền nhân sự).
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/uploads/contracts", StringComparison.OrdinalIgnoreCase))
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }
    await next();
});

app.UseStaticFiles();
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(
        Path.Combine(builder.Environment.ContentRootPath, "wwwroot", "uploads")),
    RequestPath = "/uploads",
    ServeUnknownFileTypes = false // chỉ phục vụ các loại file đã biết (ảnh...)
});

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();
app.MapHub<NotificationHub>("/notificationHub");

app.Run();