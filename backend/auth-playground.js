import argon2 from 'argon2';

async function hashingDemo() {
    const password = 'MySecretPassword';
    console.log('Original password:', password);

    const hashedPassword = await argon2.hash(password);
    console.log('Hashed password:', hashedPassword);

    const isValid = await argon2.verify(hashedPassword, password);
    console.log('Is password valid?', isValid);

    const isWrongPassword = await argon2.verify(hashedPassword, 'wrongPassword');
    console.log('Is wrong password?', isWrongPassword);

    const hashedPassword2 = await argon2.hash(password);
    console.log('Hashed password (again):', hashedPassword2);
    console.log('Are the passwords the same?', hashedPassword === hashedPassword2);
}

hashingDemo();