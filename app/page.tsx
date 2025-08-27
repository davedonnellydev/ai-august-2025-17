import React from 'react';
import { Container, Stack, Title, Text } from '@mantine/core';
import JobForm from '@/components/JobForm';

export default function HomePage() {
  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>AI Interview Coach</Title>
          <Text c="dimmed">
            Practice realistic interview questions and get actionable feedback.
          </Text>
        </div>
        <JobForm />
      </Stack>
    </Container>
  );
}
