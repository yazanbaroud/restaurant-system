# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY backend/Restaurant.API/Restaurant.API.csproj backend/Restaurant.API/
RUN dotnet restore backend/Restaurant.API/Restaurant.API.csproj

COPY backend/Restaurant.API/ backend/Restaurant.API/
RUN dotnet publish backend/Restaurant.API/Restaurant.API.csproj -c Release -o /app/publish --no-restore -p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

COPY --from=build /app/publish .
EXPOSE 8080

ENTRYPOINT ["dotnet", "Restaurant.API.dll"]
