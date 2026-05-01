# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY Restaurant.API.csproj ./
RUN dotnet restore Restaurant.API.csproj

COPY . ./
RUN dotnet publish Restaurant.API.csproj -c Release -o /app/publish -p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

COPY --from=build /app/publish .
EXPOSE 8080

ENTRYPOINT ["dotnet", "Restaurant.API.dll"]
