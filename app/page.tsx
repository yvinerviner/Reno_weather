"use client";

import { useEffect, useState } from "react";

const RENO_LAT = 39.5296;
const RENO_LON = -119.8138;
const RENO_TZ = "America/Los_Angeles";

type WeatherData = {
  temperatureF: number;
  feelsLikeF: number;
  weatherCode: number;
  humidity: number;
  windSpeedMph: number;
  windDirectionDeg: number;
};

type DailyForecast = {
  date: string;
  weatherCode: number;
  maxF: number;
  minF: number;
  precipitationChance: number;
};

function weatherCodeToDescription(code: number): string {
  const map: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
  };
  return map[code] ?? "Unknown";
}

function weatherCodeToIcon(code: number): string {
  if (code === 0 || code === 1) return "☀️";
  if (code === 2) return "⛅";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "🌧️";
  if ([71, 73, 75].includes(code)) return "❄️";
  if (code === 95) return "⛈️";
  return "❓";
}

function degreesToCompass(deg: number): string {
  const directions = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return directions[Math.round(deg / 22.5) % 16];
}

export default function Home() {
  const [now, setNow] = useState<Date | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${RENO_LAT}&longitude=${RENO_LON}` +
          `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m` +
          `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
          `&temperature_unit=fahrenheit&wind_speed_unit=mph` +
          `&timezone=${encodeURIComponent(RENO_TZ)}&forecast_days=6`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Weather request failed");
        const data = await res.json();

        setWeather({
          temperatureF: data.current.temperature_2m,
          feelsLikeF: data.current.apparent_temperature,
          weatherCode: data.current.weather_code,
          humidity: data.current.relative_humidity_2m,
          windSpeedMph: data.current.wind_speed_10m,
          windDirectionDeg: data.current.wind_direction_10m,
        });

        const days: DailyForecast[] = data.daily.time
          .map((date: string, i: number) => ({
            date,
            weatherCode: data.daily.weather_code[i],
            maxF: data.daily.temperature_2m_max[i],
            minF: data.daily.temperature_2m_min[i],
            precipitationChance: data.daily.precipitation_probability_max[i],
          }))
          .slice(1, 6);
        setForecast(days);
      } catch {
        setError("Could not load weather data.");
      }
    }
    fetchWeather();
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const timeString = now
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: RENO_TZ,
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(now)
    : "--:--:--";

  const dateString = now
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: RENO_TZ,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(now)
    : "";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-100 to-sky-300 dark:from-zinc-900 dark:to-zinc-800 px-6 py-12">
      <main className="flex w-full max-w-2xl flex-col items-center gap-6 rounded-2xl bg-white/80 dark:bg-black/40 p-10 shadow-xl backdrop-blur">
        <h1 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-100">
          Reno, Nevada
        </h1>

        <div className="text-center">
          <p className="text-5xl font-bold tabular-nums text-zinc-900 dark:text-white">
            {timeString}
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {dateString}
          </p>
        </div>

        {error && <p className="text-red-500">{error}</p>}
        {!error && !weather && (
          <p className="text-zinc-500 dark:text-zinc-400">Loading weather…</p>
        )}

        {weather && (
          <>
            <div className="text-center">
              <p className="text-6xl font-bold text-orange-500">
                {Math.round(weather.temperatureF)}°F
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                {weatherCodeToIcon(weather.weatherCode)}{" "}
                {weatherCodeToDescription(weather.weatherCode)}
              </p>
            </div>

            <div className="grid w-full grid-cols-3 gap-4 rounded-xl bg-white/60 dark:bg-white/5 p-4 text-center">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Feels like
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                  {Math.round(weather.feelsLikeF)}°F
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Humidity
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                  {weather.humidity}%
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Wind
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                  {Math.round(weather.windSpeedMph)} mph {degreesToCompass(weather.windDirectionDeg)}
                </p>
              </div>
            </div>
          </>
        )}

        {forecast.length > 0 && (
          <div className="grid w-full grid-cols-5 gap-2">
            {forecast.map((day) => (
              <div
                key={day.date}
                className="flex flex-col items-center gap-1 rounded-xl bg-white/60 dark:bg-white/5 p-3 text-center"
              >
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  {new Intl.DateTimeFormat("en-US", {
                    weekday: "short",
                    timeZone: "UTC",
                  }).format(new Date(`${day.date}T00:00:00Z`))}
                </p>
                <p className="text-2xl">{weatherCodeToIcon(day.weatherCode)}</p>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                  {Math.round(day.maxF)}°
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {Math.round(day.minF)}°
                </p>
                <p className="text-xs text-sky-600 dark:text-sky-400">
                  💧{day.precipitationChance}%
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
