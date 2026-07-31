import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const LoadingState = () => {
  const skeletons = Array(6).fill(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
      {skeletons.map((_, index) => (
        <Card key={index} className="bg-white/5 border-white/10 overflow-hidden">
          <CardHeader className="space-y-2">
            <div className="h-6 w-3/4 bg-gray-700/50 rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-gray-700/30 rounded animate-pulse" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="h-4 w-full bg-gray-700/30 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-gray-700/30 rounded animate-pulse" />
            </div>
            <div className="flex gap-2 pt-2">
              <div className="h-6 w-20 bg-gray-700/40 rounded-full animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default LoadingState;