namespace VNEB.Responses
{
    public class Response
    {
        public int Code { get; set; }
        public string? Message { get; set; }
        public object? Data { get; set; }
    }

    public enum ResponseCode
    {
        Success = 200,
        NotFound = 404,
        BadRequest = 400,
        InternalServerError = 500,
        Unauthorized = 401
    }
}