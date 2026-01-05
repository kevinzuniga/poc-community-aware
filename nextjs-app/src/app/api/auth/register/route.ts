import { NextRequest, NextResponse } from 'next/server';
import { createUser, findUserByEmail } from '@/lib/db';
import { hashPassword, generateToken, setAuthCookie } from '@/lib/auth';
import { createMember, findMemberByEmail } from '@/lib/circle';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }

    // Create or find Circle member
    let circleMemberId: number | undefined;
    try {
      let circleMember = await findMemberByEmail(email);

      if (!circleMember) {
        console.log(`Creating Circle member for ${email}`);
        circleMember = await createMember({ email, name: name || email.split('@')[0] });
      }

      circleMemberId = circleMember.id;
      console.log(`Circle member ID: ${circleMemberId}`);
    } catch (error) {
      console.error('Error with Circle member:', error);
      // Continue without Circle integration
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const user = await createUser(email, passwordHash, name || email.split('@')[0], circleMemberId);

    // Generate token
    const token = generateToken({ userId: user.id, email: user.email });

    // Set cookie
    await setAuthCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        circleMemberId: user.circle_member_id,
      },
      token,
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: error.message || 'Registration failed' },
      { status: 500 }
    );
  }
}
