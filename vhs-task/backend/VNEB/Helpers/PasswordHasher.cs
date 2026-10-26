using System.Security.Cryptography;
using System.Text;

namespace VNEB.Helpers
{
    /// <summary>
    /// Băm mật khẩu bằng PBKDF2-SHA256 có salt riêng cho từng người dùng.
    /// Định dạng lưu: PBKDF2$<số vòng lặp>$<salt base64>$<hash base64>
    /// Vẫn đọc được mật khẩu cũ (SHA256 không salt) và báo cần nâng cấp để tự chuyển đổi khi người dùng đăng nhập.
    /// </summary>
    public static class PasswordHasher
    {
        private const string Prefix = "PBKDF2";
        private const int Iterations = 100_000;
        private const int SaltSize = 16;
        private const int KeySize = 32;

        public static string Hash(string password)
        {
            var salt = RandomNumberGenerator.GetBytes(SaltSize);
            var key = Rfc2898DeriveBytes.Pbkdf2(password ?? string.Empty, salt, Iterations, HashAlgorithmName.SHA256, KeySize);
            return $"{Prefix}${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(key)}";
        }

        /// <param name="needsUpgrade">true nếu mật khẩu đúng nhưng đang lưu theo kiểu cũ -> nên băm lại</param>
        public static bool Verify(string password, string? storedHash, out bool needsUpgrade)
        {
            needsUpgrade = false;
            if (string.IsNullOrEmpty(storedHash)) return false;
            password ??= string.Empty;

            if (storedHash.StartsWith(Prefix + "$", StringComparison.Ordinal))
            {
                var parts = storedHash.Split('$');
                if (parts.Length != 4 || !int.TryParse(parts[1], out var iterations)) return false;
                try
                {
                    var salt = Convert.FromBase64String(parts[2]);
                    var expected = Convert.FromBase64String(parts[3]);
                    var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
                    var ok = CryptographicOperations.FixedTimeEquals(actual, expected);
                    needsUpgrade = ok && iterations < Iterations;
                    return ok;
                }
                catch (FormatException)
                {
                    return false;
                }
            }

            // Định dạng cũ: SHA256 không salt, base64
            var legacy = Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(password)));
            var match = CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(legacy), Encoding.UTF8.GetBytes(storedHash));
            needsUpgrade = match;
            return match;
        }
    }
}
