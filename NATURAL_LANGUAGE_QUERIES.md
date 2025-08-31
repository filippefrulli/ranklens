# Query Suggestion Service - Natural Language Update

## Overview
Updated the query suggestion service to generate more natural, conversational queries that represent how users would actually ask an AI assistant, rather than keyword-based search queries.

## Changes Made

### Before (Keyword-style)
- "best pizza delivery near Temple Bar"
- "top Italian restaurants in Dublin city center" 
- "most recommended pizza places in Dublin 2"
- "highest rated pizzerias near Grafton Street"

### After (Natural Language)
- "I am looking for a fun Dublin city tour for a couple visiting for the weekend"
- "Can you recommend the best guided walking tours in Dublin city center?"
- "I want to find a great Italian restaurant in Temple Bar for a date night"
- "I need a good coffee shop in Dublin city center with wifi for working"

## Key Changes in Prompt

### 1. **Conversational Structure**
- Changed from keyword queries to full sentences
- Added first-person language ("I am looking for", "I need", "Can you recommend")
- Made queries sound like natural human speech

### 2. **Context and Specificity**
- Added occasion context: "for a date night", "for a business meeting"
- Included group size: "for a couple", "for my family" 
- Added specific needs: "with wifi for working", "that delivers"
- Purpose clarity: "for a special celebration", "for weekend brunch"

### 3. **Conversational Starters**
- "I am looking for..."
- "I need help finding..."
- "Can you recommend..."
- "I want to find..."
- "What are the best options for..."
- "I'm searching for..."

### 4. **Natural Location References**
- Maintained natural location terms like "Dublin city center", "Temple Bar"
- Integrated locations naturally into sentences
- Avoided technical terms and postal codes

## Benefits

1. **More Realistic**: Queries now match how people actually talk to AI assistants
2. **Better Context**: Include specific needs and occasions for more relevant results
3. **Natural Flow**: Complete sentences that sound human and conversational
4. **Varied Styles**: Mix of different conversation starters and contexts
5. **Maintained Ranking Focus**: Still generate queries that produce ranked business lists

## Examples by Business Type

### Tour Company
- "I am looking for a fun Dublin city tour for a couple visiting for the weekend"
- "Can you recommend the best guided walking tours in Dublin city center?"
- "I need help finding an interesting historical tour of Dublin for my family"

### Restaurant
- "I want to find a great Italian restaurant in Temple Bar for a date night"
- "What are the best pizza places near Grafton Street that deliver?"
- "I'm looking for a cozy restaurant in Dublin 8 for a business lunch"

### Coffee Shop
- "I need a good coffee shop in Dublin city center with wifi for working"
- "Can you recommend the best cafes around Trinity College for studying?"
- "I'm searching for a great brunch spot in the Liberties area"

This update makes the generated queries much more natural and representative of how users actually interact with AI assistants in conversational contexts.
