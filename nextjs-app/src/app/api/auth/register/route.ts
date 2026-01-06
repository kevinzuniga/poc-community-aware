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
      console.log(`[Register] Searching for Circle member with email: ${email}`);
      let circleMember = await findMemberByEmail(email);
      console.log(`[Register] findMemberByEmail result:`, circleMember);

      if (!circleMember) {
        console.log(`[Register] No member found, creating new Circle member for ${email}`);
        circleMember = await createMember({ email, name: name || email.split('@')[0] });
        console.log(`[Register] createMember result:`, circleMember);
      }

      if (circleMember && circleMember.id) {
        circleMemberId = circleMember.id;
        console.log(`[Register] Circle member ID set to: ${circleMemberId}`);
      } else {
        console.error(`[Register] ERROR: circleMember exists but has no ID:`, circleMember);
      }
    } catch (error: any) {
      console.error('[Register] ERROR creating/finding Circle member:', error.message || error);
      // Don't continue without Circle - this is critical
      return NextResponse.json(
        { error: `Failed to create Circle member: ${error.message}` },
        { status: 500 }
      );
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
