import React from 'react';
import { Button, Container, Group, Stack, Title, Text } from '@mantine/core';
import Link from 'next/link';
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
        <Group justify="flex-end">
          <Button component={Link} href="/history" variant="light">
            View history
          </Button>
        </Group>
        <JobForm />
      </Stack>
    </Container>
  );
}
