FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY VNEB.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /out .
# Program.cs bắt buộc thư mục uploads tồn tại; compose mount volume vào đây
RUN mkdir -p wwwroot/uploads && chown -R app wwwroot
USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "VNEB.dll"]
