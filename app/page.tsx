"use client";

import { useEffect, useState } from "react";

const RENO_LAT = 39.5296;
const RENO_LON = -119.8138;
const RENO_TZ = "America/Los_Angeles";

type WeatherData = {
  temperatureF: number;
  weatherCode: number;
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

export default function Home() {
  const [now, setNow] = useState<Date | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${RENO_LAT}&longitude=${RENO_LON}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Weather request failed");
        const data = await res.json();
        setWeather({
          temperatureF: data.current.temperature_2m,
          weatherCode: data.current.weather_code,
        });
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-100 to-sky-300 dark:from-zinc-900 dark:to-zinc-800 px-6">
      <main className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl bg-white/80 dark:bg-black/40 p-10 shadow-xl backdrop-blur">
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

        <div className="text-center">
          {error && <p className="text-red-500">{error}</p>}
          {!error && !weather && (
            <p className="text-zinc-500 dark:text-zinc-400">Loading weather…</p>
          )}
          {weather && (
            <>
              <p className="text-6xl font-bold text-orange-500">
                {Math.round(weather.temperatureF)}°F
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                {weatherCodeToDescription(weather.weatherCode)}
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
