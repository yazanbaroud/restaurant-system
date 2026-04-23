using Restaurant.API.Enums;

namespace Restaurant.API.DTOs;

public sealed record CreateTableDto(string Name, int Capacity, TableStatus Status);
public sealed record UpdateTableDto(string Name, int Capacity, TableStatus Status);
public sealed record UpdateTableStatusDto(TableStatus Status);
public sealed record TableResponseDto(int Id, string Name, int Capacity, TableStatus Status);
