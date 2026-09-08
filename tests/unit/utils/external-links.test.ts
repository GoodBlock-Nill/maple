import { describe, expect, it } from 'vitest'

import {
  DISCORD_URL_FALLBACK,
  FACEBOOK_URL_FALLBACK,
  PLAY_URL_FALLBACK,
  YOUTUBE_URL_FALLBACK,
  isSafeExternalUrl,
  resolveDiscordDestination,
  resolvePlayDestination,
  resolveSnsDestination,
  resolveYoutubeDestination,
} from '@/lib/utils/external-links'

describe('isSafeExternalUrl', () => {
  it('should return true when given an https URL', () => {
    // Arrange
    const value = 'https://discord.com/invite/abc'

    // Act
    const result = isSafeExternalUrl(value)

    // Assert
    expect(result).toBe(true)
  })

  it('should return true when given an http URL', () => {
    // Arrange
    const value = 'http://example.com'

    // Act
    const result = isSafeExternalUrl(value)

    // Assert
    expect(result).toBe(true)
  })

  it('should return false when given a javascript: URL', () => {
    // Arrange
    const value = 'javascript:alert(1)'

    // Act
    const result = isSafeExternalUrl(value)

    // Assert
    expect(result).toBe(false)
  })

  it('should return false when given a malformed string', () => {
    // Arrange
    const value = 'not a url'

    // Act
    const result = isSafeExternalUrl(value)

    // Assert
    expect(result).toBe(false)
  })
})

describe('resolvePlayDestination', () => {
  it('should return the fallback URL when worldId is null', () => {
    // Arrange & Act
    const result = resolvePlayDestination(null)

    // Assert
    expect(result).toBe(PLAY_URL_FALLBACK)
  })

  it('should return the fallback URL when worldId is undefined', () => {
    // Arrange & Act
    const result = resolvePlayDestination(undefined)

    // Assert
    expect(result).toBe(PLAY_URL_FALLBACK)
  })

  it('should return the fallback URL when worldId is an empty string', () => {
    // Arrange & Act
    const result = resolvePlayDestination('')

    // Assert
    expect(result).toBe(PLAY_URL_FALLBACK)
  })

  it('should return the fallback URL when worldId is whitespace only', () => {
    // Arrange & Act
    const result = resolvePlayDestination('   ')

    // Assert
    expect(result).toBe(PLAY_URL_FALLBACK)
  })

  it('should build the world play URL when worldId is present', () => {
    // Arrange
    const worldId = 'my-world-123'

    // Act
    const result = resolvePlayDestination(worldId)

    // Assert
    expect(result).toBe('https://maplestoryworlds.nexon.com/ko/play/my-world-123')
  })

  it('should trim surrounding whitespace when worldId has padding', () => {
    // Arrange
    const worldId = '  my-world-123  '

    // Act
    const result = resolvePlayDestination(worldId)

    // Assert
    expect(result).toBe('https://maplestoryworlds.nexon.com/ko/play/my-world-123')
  })

  it('should percent-encode worldId when it contains reserved characters', () => {
    // Arrange
    const worldId = 'a/b c'

    // Act
    const result = resolvePlayDestination(worldId)

    // Assert
    expect(result).toBe('https://maplestoryworlds.nexon.com/ko/play/a%2Fb%20c')
  })
})

describe('resolveDiscordDestination', () => {
  it('should return the fallback URL when discordUrl is null', () => {
    // Arrange & Act
    const result = resolveDiscordDestination(null)

    // Assert
    expect(result).toBe(DISCORD_URL_FALLBACK)
  })

  it('should return the fallback URL when discordUrl is an empty string', () => {
    // Arrange & Act
    const result = resolveDiscordDestination('')

    // Assert
    expect(result).toBe(DISCORD_URL_FALLBACK)
  })

  it('should return the fallback URL when discordUrl is whitespace only', () => {
    // Arrange & Act
    const result = resolveDiscordDestination('   ')

    // Assert
    expect(result).toBe(DISCORD_URL_FALLBACK)
  })

  it('should return the configured URL when discordUrl is a valid https URL', () => {
    // Arrange
    const discordUrl = 'https://discord.gg/abc123'

    // Act
    const result = resolveDiscordDestination(discordUrl)

    // Assert
    expect(result).toBe('https://discord.gg/abc123')
  })

  it('should return the fallback URL when discordUrl uses an unsafe scheme', () => {
    // Arrange
    const discordUrl = 'javascript:alert(1)'

    // Act
    const result = resolveDiscordDestination(discordUrl)

    // Assert
    expect(result).toBe(DISCORD_URL_FALLBACK)
  })
})

describe('resolveYoutubeDestination', () => {
  it('should return the fallback URL when youtubeUrl is null', () => {
    // Arrange & Act
    const result = resolveYoutubeDestination(null)

    // Assert
    expect(result).toBe(YOUTUBE_URL_FALLBACK)
  })

  it('should return the official 세글자 channel URL when youtubeUrl is null', () => {
    // Arrange & Act
    const result = resolveYoutubeDestination(null)

    // Assert
    expect(result).toBe('https://www.youtube.com/@%EC%84%B8%EA%B8%80%EC%9E%90')
  })

  it('should return the configured URL when youtubeUrl is a valid https URL', () => {
    // Arrange
    const youtubeUrl = 'https://youtube.com/@example'

    // Act
    const result = resolveYoutubeDestination(youtubeUrl)

    // Assert
    expect(result).toBe('https://youtube.com/@example')
  })

  it('should return the fallback URL when youtubeUrl uses an unsafe scheme', () => {
    // Arrange
    const youtubeUrl = 'javascript:alert(1)'

    // Act
    const result = resolveYoutubeDestination(youtubeUrl)

    // Assert
    expect(result).toBe(YOUTUBE_URL_FALLBACK)
  })
})

describe('resolveSnsDestination', () => {
  const emptySettings = { discordUrl: null, youtubeUrl: null }

  it('should return the youtube fallback URL when name is youtube and youtubeUrl is null', () => {
    // Arrange & Act
    const result = resolveSnsDestination('youtube', emptySettings)

    // Assert
    expect(result).toBe(YOUTUBE_URL_FALLBACK)
  })

  it('should return the configured youtube URL when name is youtube and youtubeUrl is set', () => {
    // Arrange
    const settings = { discordUrl: null, youtubeUrl: 'https://youtube.com/@example' }

    // Act
    const result = resolveSnsDestination('youtube', settings)

    // Assert
    expect(result).toBe('https://youtube.com/@example')
  })

  it('should return the facebook fallback URL when name is facebook', () => {
    // Arrange & Act
    const result = resolveSnsDestination('facebook', emptySettings)

    // Assert
    expect(result).toBe(FACEBOOK_URL_FALLBACK)
  })

  it('should return the discord destination when name is discord', () => {
    // Arrange
    const settings = { discordUrl: 'https://discord.gg/abc123', youtubeUrl: null }

    // Act
    const result = resolveSnsDestination('discord', settings)

    // Assert
    expect(result).toBe('https://discord.gg/abc123')
  })

  it('should return null when name is unknown', () => {
    // Arrange & Act
    const result = resolveSnsDestination('foo', emptySettings)

    // Assert
    expect(result).toBeNull()
  })

  it('should return null when name is an empty string', () => {
    // Arrange & Act
    const result = resolveSnsDestination('', emptySettings)

    // Assert
    expect(result).toBeNull()
  })
})
